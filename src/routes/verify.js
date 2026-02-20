import express from 'express';

import {
  incVerifyRequest,
  observeVerifyRequestDuration,
} from '../config/metrics.js';
import { verifyRateLimiter } from '../middlewares/verifyRateLimiter.js';
import {
  Document,
  DocumentStatus,
  DocumentUserSign,
  SignType,
  User,
} from '../models/index.js';
import { verifyToken } from '../utils/verifyDocHmac.js';

const router = express.Router();

const VERIFY_TTL_DAYS = Number.parseInt(
  process.env.VERIFY_TOKEN_TTL_DAYS || '365',
  10
);
const MIN_PUBLIC_SIGNED_AT_MS = Date.UTC(2000, 0, 1, 0, 0, 0);
const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const UUID_V4_LIKE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ttlMs() {
  if (!Number.isFinite(VERIFY_TTL_DAYS) || VERIFY_TTL_DAYS <= 0) {
    return 365 * 24 * 60 * 60 * 1000;
  }
  return Math.min(VERIFY_TTL_DAYS, 3650) * 24 * 60 * 60 * 1000;
}

function mskDate(value) {
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
      hour12: false,
    }).format(date);
  } catch {
    return null;
  }
}

function signerFio(user) {
  return [user?.last_name, user?.first_name, user?.patronymic]
    .filter(Boolean)
    .join(' ');
}

function publicMessage(result) {
  switch (result) {
    case 'valid':
      return 'Подпись документа подтверждена.';
    case 'expired':
      return 'Срок действия QR-кода истек. Запросите актуальную копию документа.';
    case 'not_found':
      return 'Документ не найден. Проверьте QR-код или используйте актуальную версию документа.';
    case 'revoked':
      return 'Документ больше не находится в подписанном состоянии.';
    case 'mismatch':
      return 'Данные подписи не совпадают с документом.';
    default:
      return 'Не удалось подтвердить подлинность документа.';
  }
}

function readToken(req) {
  const header = String(
    req.get('X-Verify-Token') || req.get('x-verify-token') || ''
  ).trim();
  if (header) return { token: header, source: 'header' };
  const query = String(req.query.t || '').trim();
  if (query) return { token: query, source: 'query' };
  return { token: '', source: 'none' };
}

function sendNoStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function sendFailure({
  res,
  status,
  result,
  error,
  tokenVersion = 'unknown',
  source = 'query',
  startedAt,
}) {
  const payload = {
    ok: false,
    result,
    error,
    message: publicMessage(result),
    verifiedAt: new Date().toISOString(),
  };
  incVerifyRequest(result, tokenVersion, source);
  observeVerifyRequestDuration(result, (Date.now() - startedAt) / 1000);
  return res.status(status).json(payload);
}

function isExpiredBySignedAt(signedAt) {
  if (!signedAt) return true;
  const date = signedAt instanceof Date ? signedAt : new Date(signedAt);
  if (Number.isNaN(date.getTime())) return true;
  return Date.now() > date.getTime() + ttlMs();
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isPlausibleSignedAt(date, nowMs = Date.now()) {
  if (!date) return false;
  const ts = date.getTime();
  if (!Number.isFinite(ts)) return false;
  if (ts < MIN_PUBLIC_SIGNED_AT_MS) return false;
  if (ts > nowMs + FUTURE_CLOCK_SKEW_MS) return false;
  return true;
}

function parseTokenIssuedAt(payload) {
  const iat = Number(payload?.iat || 0);
  if (!Number.isFinite(iat) || iat <= 0) return null;
  return parseDate(iat * 1000);
}

function resolvePublicSignedAt(signCreatedAt, payload) {
  const dbSignedAt = parseDate(signCreatedAt);
  if (isPlausibleSignedAt(dbSignedAt)) return dbSignedAt;

  const tokenIssuedAt = parseTokenIssuedAt(payload);
  if (isPlausibleSignedAt(tokenIssuedAt)) return tokenIssuedAt;

  return null;
}

function isUuidLike(value) {
  return UUID_V4_LIKE_RE.test(String(value || '').trim());
}

/**
 * @swagger
 * /verify:
 *   get:
 *     summary: Verify a signed document token
 *     description: |-
 *       Validates a signed verification token embedded in a document QR and returns
 *       public confirmation details if valid. No authentication required.
 *     parameters:
 *       - in: header
 *         name: X-Verify-Token
 *         required: false
 *         schema:
 *           type: string
 *         description: Signed verification token (preferred transport)
 *       - in: query
 *         name: t
 *         required: false
 *         schema:
 *           type: string
 *         description: Legacy signed token query parameter
 *     responses:
 *       200:
 *         description: Verification result
 */
router.get('/', verifyRateLimiter, async (req, res) => {
  const startedAt = Date.now();
  sendNoStore(res);

  const { token, source } = readToken(req);
  if (!token) {
    return sendFailure({
      res,
      status: 400,
      result: 'invalid',
      error: 'invalid_token',
      source,
      startedAt,
    });
  }

  const tokenCheck = verifyToken(token);
  const tokenVersion = String(tokenCheck?.version || 'unknown');
  const tokenVersionNumber = Number(tokenCheck?.version || 1);
  if (!tokenCheck.ok) {
    const expired = tokenCheck.error === 'expired';
    return sendFailure({
      res,
      status: expired ? 410 : 400,
      result: expired ? 'expired' : 'invalid',
      error: expired ? 'token_expired' : 'invalid_token',
      tokenVersion,
      source,
      startedAt,
    });
  }

  const payload = tokenCheck.payload;
  if (
    !payload ||
    !isUuidLike(payload.d) ||
    !isUuidLike(payload.s) ||
    !isUuidLike(payload.u)
  ) {
    return sendFailure({
      res,
      status: 400,
      result: 'invalid',
      error: 'invalid_token',
      tokenVersion,
      source,
      startedAt,
    });
  }

  const doc = await Document.findByPk(payload.d, {
    include: [{ model: DocumentStatus, attributes: ['alias', 'name'] }],
    attributes: ['id', 'number', 'name', 'document_date'],
  });
  if (!doc) {
    return sendFailure({
      res,
      status: 404,
      result: 'not_found',
      error: 'not_found',
      tokenVersion,
      source,
      startedAt,
    });
  }

  const sign = await DocumentUserSign.findByPk(payload.s, {
    include: [
      {
        model: User,
        attributes: ['last_name', 'first_name', 'patronymic'],
      },
      { model: SignType, attributes: ['alias', 'name'] },
    ],
  });
  if (
    !sign ||
    String(sign.document_id) !== String(doc.id) ||
    String(sign.user_id) !== String(payload.u)
  ) {
    return sendFailure({
      res,
      status: 400,
      result: 'mismatch',
      error: 'mismatch',
      tokenVersion,
      source,
      startedAt,
    });
  }

  if (doc.DocumentStatus?.alias !== 'SIGNED') {
    return sendFailure({
      res,
      status: 409,
      result: 'revoked',
      error: 'status_invalid',
      tokenVersion,
      source,
      startedAt,
    });
  }

  const requireLegacySignTtlCheck =
    Number.isFinite(tokenVersionNumber) && tokenVersionNumber < 2;
  if (requireLegacySignTtlCheck && isExpiredBySignedAt(sign.created_at)) {
    return sendFailure({
      res,
      status: 410,
      result: 'expired',
      error: 'token_expired',
      tokenVersion,
      source,
      startedAt,
    });
  }

  const signedAt = resolvePublicSignedAt(sign.created_at, payload);
  const response = {
    ok: true,
    result: 'valid',
    message: publicMessage('valid'),
    verifiedAt: new Date().toISOString(),
    document: {
      number: doc.number || null,
      name: doc.name || null,
      documentDate: doc.document_date || null,
      status: doc.DocumentStatus?.alias || null,
    },
    signer: {
      fio: signerFio(sign.User) || null,
    },
    signature: {
      type: sign.SignType?.name || null,
      typeAlias: sign.SignType?.alias || null,
      signedAt: signedAt?.toISOString?.() || null,
      signedAtMsk: mskDate(signedAt),
    },
  };

  incVerifyRequest('valid', tokenVersion, source);
  observeVerifyRequestDuration('valid', (Date.now() - startedAt) / 1000);
  return res.json(response);
});

export default router;
