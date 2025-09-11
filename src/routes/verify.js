import express from 'express';

import { verifyToken } from '../utils/verifyDocHmac.js';
import {
  Document,
  DocumentStatus,
  DocumentUserSign,
  User,
} from '../models/index.js';

const router = express.Router();

/**
 * @swagger
 * /verify:
 *   get:
 *     summary: Verify a signed document token
 *     description: |-
 *       Validates a signed verification token embedded in a document QR and returns
 *       minimal confirmation details if valid. No authentication required.
 *     parameters:
 *       - in: query
 *         name: t
 *         required: true
 *         schema:
 *           type: string
 *         description: Compact signed token
 *     responses:
 *       200:
 *         description: Verification result
 */
router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const t = String(req.query.t || '');
  const { ok, payload } = verifyToken(t);
  if (!ok) return res.status(400).json({ ok: false, error: 'invalid_token' });
  const doc = await Document.findByPk(payload.d, {
    include: [
      { model: DocumentStatus, attributes: ['alias', 'name'] },
      {
        model: User,
        as: 'recipient',
        attributes: ['id', 'last_name', 'first_name', 'patronymic'],
      },
    ],
  });
  if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });
  const sign = await DocumentUserSign.findByPk(payload.s);
  if (!sign || sign.document_id !== doc.id)
    return res.status(400).json({ ok: false, error: 'mismatch' });
  // Optionally ensure the signer id matches payload
  if (String(sign.user_id) !== String(payload.u))
    return res.status(400).json({ ok: false, error: 'mismatch' });
  const signed = doc.DocumentStatus?.alias === 'SIGNED';
  // Normalize and enrich signing timestamp
  let signedAtIso = null;
  let signedAtMsk = null;
  let signedAtMs = null;
  try {
    const src = sign.created_at;
    const d = src instanceof Date ? src : new Date(src);
    if (!Number.isNaN(d?.getTime?.())) {
      signedAtIso = d.toISOString();
      signedAtMs = d.getTime();
      try {
        signedAtMsk = new Intl.DateTimeFormat('ru-RU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Moscow',
          hour12: false,
        }).format(d);
      } catch {
        signedAtMsk = null;
      }
    }
  } catch {
    /* ignore */
  }
  const fio = [
    doc.recipient?.last_name,
    doc.recipient?.first_name,
    doc.recipient?.patronymic,
  ]
    .filter(Boolean)
    .join(' ');
  return res.json({
    ok: true,
    status: signed ? 'SIGNED' : doc.DocumentStatus?.alias || 'UNKNOWN',
    document: {
      id: doc.id,
      number: doc.number,
      name: doc.name,
      documentDate: doc.document_date,
    },
    signer: { id: doc.recipient?.id, fio },
    sign: { id: sign.id, signedAt: signedAtIso, signedAtMs, signedAtMsk },
  });
});

export default router;
