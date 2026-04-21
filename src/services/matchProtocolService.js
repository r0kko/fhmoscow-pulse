import { randomUUID } from 'crypto';

import { Op } from 'sequelize';

import logger from '../../logger.js';
import {
  isMatchProtocolConfigured,
  MATCH_PROTOCOL_CONFIG,
} from '../config/matchProtocol.js';
import ServiceError from '../errors/ServiceError.js';
import {
  File,
  GameStatus,
  Match,
  MatchProtocolSnapshot,
  Role,
  SignType,
  Team,
  User,
  UserSignType,
  UserStatus,
} from '../models/index.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';

import fileService from './fileService.js';
import { fetchMatchProtocolPdf } from './matchProtocolClient.js';
import { nextMatchProtocolNumber } from './numberingService.js';

const SIGNER_ROLE_ALIASES = [
  'FHMO_JUDGING_LEAD_SPECIALIST',
  'FHMO_JUDGING_HEAD',
  'FHMO_JUDGING_SPECIALIST',
];

function fullName(user) {
  return [user?.last_name, user?.first_name, user?.patronymic]
    .filter(Boolean)
    .join(' ');
}

function isFinishedStatus(statusAlias) {
  return String(statusAlias || '').toUpperCase() === 'FINISHED';
}

function protocolAvailability(match) {
  if (!isMatchProtocolConfigured()) return false;
  if (!match?.external_id) return false;
  return isFinishedStatus(match?.GameStatus?.alias);
}

async function findActiveSigner() {
  const rows = await UserSignType.findAll({
    include: [
      {
        model: SignType,
        attributes: ['id', 'alias', 'name'],
        where: { alias: 'SIMPLE_ELECTRONIC' },
        required: true,
      },
      {
        model: User,
        attributes: ['id', 'email', 'last_name', 'first_name', 'patronymic'],
        required: true,
        include: [
          {
            model: Role,
            attributes: ['alias', 'name', 'departmentName', 'displayOrder'],
            through: { attributes: [] },
            where: { alias: { [Op.in]: SIGNER_ROLE_ALIASES } },
            required: true,
          },
          {
            model: UserStatus,
            attributes: ['alias'],
            where: { alias: 'ACTIVE' },
            required: true,
          },
        ],
      },
    ],
    order: [['sign_created_date', 'DESC']],
    subQuery: false,
  });

  const candidates = rows
    .map((item) => {
      const signer = item.User;
      const role = (signer?.Roles || [])
        .filter((candidate) => SIGNER_ROLE_ALIASES.includes(candidate.alias))
        .sort((left, right) => {
          const leftPriority = SIGNER_ROLE_ALIASES.indexOf(left.alias);
          const rightPriority = SIGNER_ROLE_ALIASES.indexOf(right.alias);
          if (leftPriority !== rightPriority)
            return leftPriority - rightPriority;
          return (left.displayOrder || 999999) - (right.displayOrder || 999999);
        })[0];
      if (!signer?.id || !role) return null;
      return {
        signer,
        signerRole: role,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftPriority = SIGNER_ROLE_ALIASES.indexOf(left.signerRole.alias);
      const rightPriority = SIGNER_ROLE_ALIASES.indexOf(right.signerRole.alias);
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return fullName(left.signer).localeCompare(fullName(right.signer), 'ru');
    });

  return candidates[0] || null;
}

async function loadMatch(matchId) {
  return Match.findByPk(matchId, {
    attributes: ['id', 'external_id', 'date_start'],
    include: [
      { model: GameStatus, attributes: ['alias', 'name'] },
      { model: Team, as: 'HomeTeam', attributes: ['name'] },
      { model: Team, as: 'AwayTeam', attributes: ['name'] },
    ],
  });
}

async function loadActiveSnapshot(matchId) {
  return MatchProtocolSnapshot.findOne({
    where: { match_id: matchId, status: 'ACTIVE' },
    include: [{ model: File, as: 'SignedFile', attributes: ['id', 'key'] }],
    order: [['signed_at', 'DESC']],
  });
}

async function renderProtocolPdf(payload) {
  try {
    const module = await import('./matchProtocolPdfService.js');
    return await module.renderMatchProtocolPdf(payload);
  } catch (err) {
    if (
      err?.code === 'ERR_MODULE_NOT_FOUND' ||
      /Cannot find package 'sharp'/.test(String(err?.message || '')) ||
      /Cannot find package 'pdf-lib'/.test(String(err?.message || ''))
    ) {
      logger.error('Match protocol render dependencies missing', {
        error: err?.message || null,
      });
      throw new ServiceError('match_protocol_render_dependencies_missing', 502);
    }
    throw err;
  }
}

function isFreshSnapshot(snapshot) {
  if (!snapshot?.last_checked_at) return false;
  const ts = new Date(snapshot.last_checked_at).getTime();
  if (!Number.isFinite(ts)) return false;
  return ts + MATCH_PROTOCOL_CONFIG.cacheTtlSeconds * 1000 > Date.now();
}

function sanitizeFilenameSegment(value) {
  return String(value || '')
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildFilename(match, snapshot) {
  const base = snapshot?.number
    ? `protocol-${sanitizeFilenameSegment(snapshot.number)}`
    : `match-protocol-${match?.external_id || match?.id || 'unknown'}`;
  return `${base}.pdf`;
}

async function readSnapshotFile(snapshot) {
  if (!snapshot?.SignedFile?.key) return null;
  try {
    return await fileService.getFileBuffer(snapshot.SignedFile);
  } catch {
    return null;
  }
}

async function waitForSnapshotResult(matchId, requestId = null) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const snapshot = await loadActiveSnapshot(matchId);
    if (snapshot) {
      const buffer = await readSnapshotFile(snapshot);
      if (buffer) {
        logger.info('Match protocol served after lock wait', {
          request_id: requestId || null,
          match_id: matchId,
          cache: 'busy-wait-hit',
        });
        return {
          buffer,
          filename: buildFilename(
            {
              id: matchId,
              external_id: snapshot.external_match_id || null,
            },
            snapshot
          ),
          snapshot,
        };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new ServiceError('match_protocol_busy', 409);
}

async function storeNewSnapshot({
  snapshotId,
  match,
  number,
  filename,
  upstream,
  signer,
  sealAssetHash,
  renderVersion,
  buffer,
  actorId,
  signedAt,
}) {
  const file = await fileService.saveGeneratedPdf(buffer, filename, actorId);

  return MatchProtocolSnapshot.sequelize.transaction(async (transaction) => {
    await MatchProtocolSnapshot.update(
      { status: 'SUPERSEDED', updated_by: actorId },
      {
        where: {
          match_id: match.id,
          status: 'ACTIVE',
        },
        transaction,
      }
    );
    const snapshot = await MatchProtocolSnapshot.create(
      {
        id: snapshotId,
        match_id: match.id,
        external_match_id: match.external_id,
        document_date: signedAt,
        number,
        upstream_etag: upstream?.etag || null,
        upstream_last_modified: upstream?.lastModified || null,
        upstream_filename: upstream?.filename || null,
        signed_file_id: file.id,
        signed_by_user_id: signer.signer.id,
        signed_role_alias: signer.signerRole.alias,
        signed_at: signedAt,
        render_version: renderVersion,
        seal_asset_hash: sealAssetHash,
        last_checked_at: signedAt,
        status: 'ACTIVE',
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction }
    );
    snapshot.setDataValue('SignedFile', file);
    return snapshot;
  });
}

export function getMatchProtocolAvailability(match) {
  return {
    configured: isMatchProtocolConfigured(),
    available: protocolAvailability(match),
  };
}

export async function downloadMatchProtocol(
  matchId,
  actorId,
  requestId = null
) {
  return withRedisLock(
    buildJobLockKey(`matchProtocol:${matchId}`),
    60_000,
    async () => {
      if (!isMatchProtocolConfigured()) {
        throw new ServiceError('match_protocol_not_configured', 502);
      }

      const match = await loadMatch(matchId);
      if (!match) throw new ServiceError('match_not_found', 404);
      if (!isFinishedStatus(match?.GameStatus?.alias)) {
        throw new ServiceError('match_protocol_requires_finished', 409);
      }
      if (!match.external_id) {
        throw new ServiceError('match_protocol_external_id_missing', 409);
      }

      const snapshot = await loadActiveSnapshot(match.id);
      if (snapshot && isFreshSnapshot(snapshot)) {
        const buffer = await readSnapshotFile(snapshot);
        if (buffer) {
          logger.info('Match protocol cache hit', {
            request_id: requestId || null,
            match_id: match.id,
            external_match_id: match.external_id,
            cache: 'fresh',
          });
          return {
            buffer,
            filename: buildFilename(match, snapshot),
            snapshot,
          };
        }
      }

      const signer = await findActiveSigner();
      if (!signer) {
        throw new ServiceError('match_protocol_signer_not_found', 503);
      }

      const upstream = await fetchMatchProtocolPdf(match.external_id, {
        etag: snapshot?.upstream_etag || null,
        lastModified: snapshot?.upstream_last_modified || null,
        requestId,
      });

      if (upstream.status === 'not_modified' && snapshot) {
        snapshot.last_checked_at = new Date();
        snapshot.upstream_etag = upstream.etag || snapshot.upstream_etag;
        snapshot.upstream_last_modified =
          upstream.lastModified || snapshot.upstream_last_modified;
        await snapshot.save();
        const buffer = await readSnapshotFile(snapshot);
        if (buffer) {
          logger.info('Match protocol cache revalidated', {
            request_id: requestId || null,
            match_id: match.id,
            external_match_id: match.external_id,
            cache: 'revalidated',
          });
          return {
            buffer,
            filename: buildFilename(match, snapshot),
            snapshot,
          };
        }
        const refreshedUpstream = await fetchMatchProtocolPdf(
          match.external_id,
          {
            requestId,
          }
        );
        if (refreshedUpstream.status !== 'ok') {
          throw new ServiceError('match_protocol_cached_file_missing', 502);
        }
        upstream.status = refreshedUpstream.status;
        upstream.buffer = refreshedUpstream.buffer;
        upstream.etag = refreshedUpstream.etag;
        upstream.lastModified = refreshedUpstream.lastModified;
        upstream.filename = refreshedUpstream.filename;
      }

      const snapshotId = randomUUID();
      const signedAt = new Date();
      const number = await nextMatchProtocolNumber(signedAt);
      const signerData =
        typeof signer.signer?.get === 'function'
          ? signer.signer.get({ plain: true })
          : signer.signer;
      const rendered = await renderProtocolPdf({
        sourceBuffer: upstream.buffer,
        matchId: match.id,
        snapshotId,
        documentNumber: number,
        signer: {
          ...signerData,
          position: signer.signerRole.name || null,
          department: signer.signerRole.departmentName || null,
          organization: 'РОО "Федерация хоккея Москвы"',
        },
        signedAt,
        signedByUserId: signer.signer.id,
      });
      const filename = upstream.filename || buildFilename(match, snapshot);
      const persisted = await storeNewSnapshot({
        snapshotId,
        match,
        number,
        filename,
        upstream,
        signer,
        sealAssetHash: rendered.sealAssetHash,
        renderVersion: rendered.renderVersion,
        buffer: rendered.buffer,
        actorId,
        signedAt,
      });

      logger.info('Match protocol snapshot created', {
        request_id: requestId || null,
        match_id: match.id,
        external_match_id: match.external_id,
        snapshot_id: persisted.id,
        signed_by_user_id: signer.signer.id,
        signed_role_alias: signer.signerRole.alias,
        cache: 'miss',
      });

      return {
        buffer: rendered.buffer,
        filename: buildFilename(match, persisted),
        snapshot: persisted,
      };
    },
    {
      onBusy: () => waitForSnapshotResult(matchId, requestId),
    }
  );
}

export default {
  downloadMatchProtocol,
  getMatchProtocolAvailability,
};
