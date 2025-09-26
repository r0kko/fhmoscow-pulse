import { Sequelize, QueryTypes } from 'sequelize';

import { utcToMoscow } from '../utils/time.js';
import './env.js';

const externalSequelize = new Sequelize(
  process.env.EXT_DB_NAME,
  process.env.EXT_DB_USER,
  process.env.EXT_DB_PASS,
  {
    host: process.env.EXT_DB_HOST,
    port: process.env.EXT_DB_PORT || 3306,
    dialect: 'mysql',
    retry: {
      // Retry transient network and connection errors automatically for individual queries
      match: [
        /ETIMEDOUT/i,
        /ECONNRESET/i,
        /EHOSTUNREACH/i,
        /SequelizeConnectionError/i,
        /SequelizeConnectionRefusedError/i,
        /SequelizeHostNotFoundError/i,
        /SequelizeHostNotReachableError/i,
        /SequelizeInvalidConnectionError/i,
        /SequelizeConnectionTimedOutError/i,
      ],
      max: Number(process.env.EXT_DB_RETRY_MAX || 3),
    },
    dialectOptions: {
      // Allow optional SSL for production-like deployments
      ssl:
        String(process.env.EXT_DB_SSL || '').toLowerCase() === 'true'
          ? {
              rejectUnauthorized:
                String(
                  process.env.EXT_DB_SSL_REJECT_UNAUTHORIZED || 'true'
                ).toLowerCase() === 'true',
            }
          : undefined,
      // Improve socket resilience and timeouts (mysql2)
      enableKeepAlive: true,
      keepAliveInitialDelay: Number(
        process.env.EXT_DB_KEEPALIVE_DELAY_MS || 10_000
      ),
      connectTimeout: Number(process.env.EXT_DB_CONNECT_TIMEOUT_MS || 10_000),
    },
    pool: {
      max: Number(process.env.EXT_DB_POOL_MAX || 10),
      min: Number(process.env.EXT_DB_POOL_MIN || 1),
      acquire: Number(process.env.EXT_DB_POOL_ACQUIRE_MS || 60_000),
      idle: Number(process.env.EXT_DB_POOL_IDLE_MS || 300_000), // keep connections around for 5m
      evict: Number(process.env.EXT_DB_POOL_EVICT_MS || 60_000),
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  }
);

// Enforce strict read-only behavior at the connection level.
// Strategy: block known data/DDL mutation operations, allow others (e.g. SET, SHOW, DESCRIBE),
// which are commonly used by the driver during connection/authentication.
const _originalQuery = externalSequelize.query.bind(externalSequelize);
externalSequelize.query = async (sql, options = {}) => {
  const type = options.type;
  const text = typeof sql === 'string' ? sql.trim() : '';
  // Keep original text; avoid unused vars for linters

  // If Sequelize provided a query type, block only the mutating ones.
  const blockedTypes = new Set([
    QueryTypes.INSERT,
    QueryTypes.UPDATE,
    QueryTypes.BULKUPDATE,
    QueryTypes.BULKDELETE,
    QueryTypes.DELETE,
    QueryTypes.UPSERT,
    QueryTypes.TRUNCATE,
  ]);
  if (type != null && blockedTypes.has(type)) {
    const err = new Error('External DB is read-only: write operation blocked');
    err.code = 'EXTERNAL_DB_READ_ONLY';
    throw err;
  }

  // Fallback: simple SQL prefix inspection to block mutations
  // Allow: SELECT/SHOW/DESCRIBE/EXPLAIN/SET/USE/BEGIN/START TRANSACTION/COMMIT/ROLLBACK and comments
  const isAllowedPrefix =
    /^(SELECT|SHOW\s|DESCRIBE|EXPLAIN|SET\s|USE\s|BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK|\/\*)/i.test(
      text
    );
  const isBlockedPrefix =
    /^(INSERT|UPDATE|DELETE|REPLACE|MERGE|CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE)\b/i.test(
      text
    );
  if (!isAllowedPrefix && isBlockedPrefix) {
    const err = new Error('External DB is read-only: write operation blocked');
    err.code = 'EXTERNAL_DB_READ_ONLY';
    throw err;
  }

  return _originalQuery(sql, options);
};

// Harden QueryInterface by disabling mutating operations as an extra safety net
const qi = externalSequelize.getQueryInterface();
const block = (name) => {
  // Only override if exists (dialect dependent)
  if (qi[name]) {
    qi[name] = async () => {
      const err = new Error(
        'External DB is read-only: write operation blocked'
      );
      err.code = 'EXTERNAL_DB_READ_ONLY';
      throw err;
    };
  }
};
[
  // Data changes
  'insert',
  'bulkInsert',
  'upsert',
  'update',
  'bulkUpdate',
  'delete',
  'bulkDelete',
  'truncate',
  // DDL changes
  'createTable',
  'dropTable',
  'addColumn',
  'removeColumn',
  'changeColumn',
  'renameColumn',
  'renameTable',
  'addConstraint',
  'removeConstraint',
  'addIndex',
  'removeIndex',
].forEach(block);

let externalDbAvailable = false;

export async function connectExternalMariaDb() {
  const { default: logger } = await import('../../logger.js');
  if (
    !process.env.EXT_DB_HOST ||
    !process.env.EXT_DB_USER ||
    !process.env.EXT_DB_NAME
  ) {
    logger.info('EXT_* env not set; skipping external MariaDB connection');
    externalDbAvailable = false;
    return;
  }
  try {
    await externalSequelize.authenticate();
    externalDbAvailable = true;
    logger.info('✅ External MariaDB connection established');
    // Set conservative per-statement execution caps to avoid hanging jobs.
    const maxExecMs = Number(process.env.EXT_DB_MAX_EXECUTION_MS || 60_000);
    const maxStmtSec = Math.max(1, Math.floor(maxExecMs / 1000));
    try {
      // MySQL 5.7+/8.0
      await externalSequelize.query(
        `SET SESSION max_execution_time = ${maxExecMs}`
      );
    } catch {
      /* empty */
    }
    try {
      // MariaDB
      await externalSequelize.query(
        `SET SESSION max_statement_time = ${maxStmtSec}`
      );
    } catch {
      /* empty */
    }
  } catch (err) {
    externalDbAvailable = false;
    logger.warn('⚠️ Unable to connect to external MariaDB: %s', err.message);
  }
}

export function isExternalDbAvailable() {
  return externalDbAvailable;
}

export async function closeExternalMariaDb() {
  await externalSequelize.close();
}

export default externalSequelize;

// Whitelisted write: update external game date_start and stadium_id only.
// This function is the single, explicit escape hatch to mutate the external DB.
// It uses the underlying driver query (_originalQuery) to bypass the read-only guards above,
// and performs strict validation and idempotency checks upstream in the caller.
export async function updateExternalGameDateAndStadium({
  gameId,
  dateStart, // UTC Date representing desired MSK time
  stadiumId,
}) {
  if (!externalDbAvailable)
    throw Object.assign(new Error('External DB unavailable'), {
      code: 'EXTERNAL_DB_UNAVAILABLE',
    });
  if (
    !gameId ||
    (typeof gameId !== 'number' && typeof gameId !== 'string') ||
    Number.isNaN(Number(gameId))
  )
    throw new Error('Invalid gameId');
  const hasDate =
    dateStart instanceof Date && !Number.isNaN(dateStart.getTime());
  if (!hasDate) throw new Error('Invalid dateStart');
  if (
    stadiumId == null ||
    (typeof stadiumId !== 'number' && typeof stadiumId !== 'string') ||
    Number.isNaN(Number(stadiumId))
  )
    throw new Error('Invalid stadiumId');

  // Perform a single UPDATE using bound parameters to avoid SQL injection.
  // Note: we do not set QueryTypes.UPDATE because the read-only guard inspects it;
  // instead we rely on raw _originalQuery and affectedRows from the driver.
  const msk = utcToMoscow(dateStart);
  const y = msk.getUTCFullYear();
  const mo = String(msk.getUTCMonth() + 1).padStart(2, '0');
  const d = String(msk.getUTCDate()).padStart(2, '0');
  const hh = String(msk.getUTCHours()).padStart(2, '0');
  const mm = String(msk.getUTCMinutes()).padStart(2, '0');
  const ss = String(msk.getUTCSeconds()).padStart(2, '0');
  const mskStr = `${y}-${mo}-${d} ${hh}:${mm}:${ss}`;
  const sql = 'UPDATE game SET date_start = ?, stadium_id = ? WHERE id = ?';
  const params = [mskStr, Number(stadiumId), Number(gameId)];
  // Use try/catch to return a consistent error shape.
  try {
    const [result] = await _originalQuery(sql, { replacements: params });
    // MySQL/MariaDB returns an OkPacket-like object with affectedRows
    const affected =
      result && (result.affectedRows || result.affected_rows || 0);
    return { ok: true, affected: Number(affected) || 0 };
  } catch (err) {
    // Normalize error code to emphasize this is a whitelisted write failure
    err.code = err.code || 'EXTERNAL_DB_WHITELISTED_WRITE_FAILED';
    throw err;
  }
}

// Whitelisted write: reschedule external game by setting date_start and clearing cancel_status
export async function updateExternalGameDateAndClearCancelStatus({
  gameId,
  dateStart,
}) {
  if (!externalDbAvailable)
    throw Object.assign(new Error('External DB unavailable'), {
      code: 'EXTERNAL_DB_UNAVAILABLE',
    });
  if (
    !gameId ||
    (typeof gameId !== 'number' && typeof gameId !== 'string') ||
    Number.isNaN(Number(gameId))
  )
    throw new Error('Invalid gameId');
  const hasDate =
    dateStart instanceof Date && !Number.isNaN(dateStart.getTime());
  if (!hasDate) throw new Error('Invalid dateStart');
  const msk = utcToMoscow(dateStart);
  const y = msk.getUTCFullYear();
  const mo = String(msk.getUTCMonth() + 1).padStart(2, '0');
  const d = String(msk.getUTCDate()).padStart(2, '0');
  const hh = String(msk.getUTCHours()).padStart(2, '0');
  const mm = String(msk.getUTCMinutes()).padStart(2, '0');
  const ss = String(msk.getUTCSeconds()).padStart(2, '0');
  const mskStr = `${y}-${mo}-${d} ${hh}:${mm}:${ss}`;
  const sql =
    'UPDATE game SET date_start = ?, cancel_status = NULL WHERE id = ?';
  const params = [mskStr, Number(gameId)];
  try {
    const [result] = await _originalQuery(sql, { replacements: params });
    const affected =
      result && (result.affectedRows || result.affected_rows || 0);
    return { ok: true, affected: Number(affected) || 0 };
  } catch (err) {
    err.code = err.code || 'EXTERNAL_DB_WHITELISTED_WRITE_FAILED';
    throw err;
  }
}

// Whitelisted write: update external player anthropometry (grip/height/weight)
export async function updateExternalPlayerAnthropometry({
  playerId,
  grip,
  height,
  weight,
}) {
  if (!externalDbAvailable)
    throw Object.assign(new Error('External DB unavailable'), {
      code: 'EXTERNAL_DB_UNAVAILABLE',
    });
  if (
    playerId == null ||
    (typeof playerId !== 'number' && typeof playerId !== 'string') ||
    Number.isNaN(Number(playerId))
  )
    throw new Error('Invalid playerId');
  // Normalize values: allow nulls; sanitize grip length
  const g = grip == null ? null : String(grip).trim().slice(0, 255) || null;
  const h =
    height == null || Number.isNaN(Number(height)) ? null : Number(height);
  const w =
    weight == null || Number.isNaN(Number(weight)) ? null : Number(weight);
  const sql = 'UPDATE player SET grip = ?, height = ?, weight = ? WHERE id = ?';
  const params = [g, h, w, Number(playerId)];
  try {
    const [result] = await _originalQuery(sql, { replacements: params });
    const affected =
      result && (result.affectedRows || result.affected_rows || 0);
    return { ok: true, affected: Number(affected) || 0 };
  } catch (err) {
    err.code = err.code || 'EXTERNAL_DB_WHITELISTED_WRITE_FAILED';
    throw err;
  }
}

// Whitelisted write: update external club_player roster fields (number, role_id)
export async function updateExternalClubPlayerNumberAndRole({
  clubPlayerId,
  number,
  roleExternalId,
}) {
  if (!externalDbAvailable)
    throw Object.assign(new Error('External DB unavailable'), {
      code: 'EXTERNAL_DB_UNAVAILABLE',
    });
  if (
    clubPlayerId == null ||
    (typeof clubPlayerId !== 'number' && typeof clubPlayerId !== 'string') ||
    Number.isNaN(Number(clubPlayerId))
  )
    throw new Error('Invalid clubPlayerId');
  // Normalize values
  const n =
    number == null || Number.isNaN(Number(number)) ? null : Number(number);
  const r =
    roleExternalId == null || Number.isNaN(Number(roleExternalId))
      ? null
      : Number(roleExternalId);
  const sql = 'UPDATE club_player SET number = ?, role_id = ? WHERE id = ?';
  const params = [n, r, Number(clubPlayerId)];
  try {
    const [result] = await _originalQuery(sql, { replacements: params });
    const affected =
      result && (result.affectedRows || result.affected_rows || 0);
    return { ok: true, affected: Number(affected) || 0 };
  } catch (err) {
    err.code = err.code || 'EXTERNAL_DB_WHITELISTED_WRITE_FAILED';
    throw err;
  }
}

function formatDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const pad = (value) => String(value).padStart(2, '0');
  const y = date.getUTCFullYear();
  const mo = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${y}-${mo}-${d} ${hh}:${mm}:${ss}`;
}

function normalizeInsertId(value) {
  if (value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num <= 0) return null;
  return Math.trunc(num);
}

function extractInsertIdFromResult(result) {
  if (!result) return null;
  if (Array.isArray(result)) {
    for (const entry of result) {
      const id = extractInsertIdFromResult(entry);
      if (id) return id;
    }
    return null;
  }
  if (typeof result === 'object') {
    return (
      normalizeInsertId(
        result.insertId ??
          result.insert_id ??
          result.lastInsertId ??
          result.LAST_INSERT_ID ??
          result.id ??
          result.ID
      ) || null
    );
  }
  return null;
}

async function fetchLastInsertId() {
  try {
    const [rows] = await _originalQuery('SELECT LAST_INSERT_ID() AS id');
    const row = Array.isArray(rows) ? rows[0] : rows;
    return normalizeInsertId(
      row?.id ?? row?.ID ?? row?.last_insert_id ?? row?.LAST_INSERT_ID
    );
  } catch (err) {
    void err;
    return null;
  }
}

async function fetchInsertIdByAttributes({ module, name }) {
  try {
    const conditions = [];
    const params = [];
    if (module == null) {
      conditions.push('module IS NULL');
    } else {
      conditions.push('module = ?');
      params.push(module);
    }
    if (name == null) {
      conditions.push('name IS NULL');
    } else {
      conditions.push('name = ?');
      params.push(name);
    }
    const where = conditions.length ? conditions.join(' AND ') : '1=1';
    const sql = `SELECT id FROM file WHERE ${where} ORDER BY id DESC LIMIT 1`;
    const [rows] = await _originalQuery(sql, { replacements: params });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return normalizeInsertId(row?.id ?? row?.ID);
  } catch (err) {
    void err;
    return null;
  }
}

async function resolveInsertedFileId(result, { module, name }) {
  const direct = extractInsertIdFromResult(result);
  if (direct) return direct;
  const last = await fetchLastInsertId();
  if (last) return last;
  return fetchInsertIdByAttributes({ module, name });
}

export async function insertExternalFileRecord({
  module,
  mimeType,
  size,
  name,
  objectStatus = 'active',
  createdAt = new Date(),
  updatedAt = createdAt,
}) {
  if (!externalDbAvailable)
    throw Object.assign(new Error('External DB unavailable'), {
      code: 'EXTERNAL_DB_UNAVAILABLE',
    });
  const normalizedCreated = utcToMoscow(createdAt);
  const normalizedUpdated = utcToMoscow(updatedAt);
  const created = formatDateTime(normalizedCreated || new Date());
  const updated = formatDateTime(normalizedUpdated || new Date());
  const normalizedSize =
    size == null || Number.isNaN(Number(size)) ? null : Number(size);
  const sql = `INSERT INTO file (module, mime_type, size, name, date_create, date_update, object_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    module || null,
    mimeType || null,
    normalizedSize,
    name || null,
    created,
    updated,
    objectStatus || null,
  ];
  try {
    const [result] = await _originalQuery(sql, { replacements: params });
    const idNum = await resolveInsertedFileId(result, { module, name });
    if (!idNum) {
      const err = new Error(
        'Failed to obtain external file identifier after insertion'
      );
      err.code = 'EXTERNAL_FILE_INSERT_FAILED';
      throw err;
    }
    return {
      id: idNum,
      module: module || null,
      mime_type: mimeType || null,
      size: normalizedSize,
      name: name || null,
      object_status: objectStatus || null,
      date_create: normalizedCreated || null,
      date_update: normalizedUpdated || null,
    };
  } catch (err) {
    err.code = err.code || 'EXTERNAL_DB_WHITELISTED_WRITE_FAILED';
    throw err;
  }
}

export async function updateExternalFileName({ fileId, name }) {
  if (!externalDbAvailable)
    throw Object.assign(new Error('External DB unavailable'), {
      code: 'EXTERNAL_DB_UNAVAILABLE',
    });
  const normalizedId =
    fileId == null || Number.isNaN(Number(fileId)) ? null : Number(fileId);
  if (!normalizedId) throw new Error('Invalid fileId');
  const trimmedName = (name || '').trim();
  if (!trimmedName) throw new Error('Invalid file name');
  const nowMsk = utcToMoscow(new Date()) || new Date();
  const nowFormatted = formatDateTime(nowMsk);
  const sql = 'UPDATE file SET name = ?, date_update = ? WHERE id = ?';
  const params = [trimmedName, nowFormatted, normalizedId];
  try {
    const [result] = await _originalQuery(sql, { replacements: params });
    const affected =
      result && (result.affectedRows || result.affected_rows || 0);
    return { ok: true, affected: Number(affected) || 0 };
  } catch (err) {
    err.code = err.code || 'EXTERNAL_DB_WHITELISTED_WRITE_FAILED';
    throw err;
  }
}

export async function updateExternalPlayerPhotoId({ playerId, fileId }) {
  if (!externalDbAvailable)
    throw Object.assign(new Error('External DB unavailable'), {
      code: 'EXTERNAL_DB_UNAVAILABLE',
    });
  if (
    playerId == null ||
    (typeof playerId !== 'number' && typeof playerId !== 'string') ||
    Number.isNaN(Number(playerId))
  )
    throw new Error('Invalid playerId');
  const normalizedFileId =
    fileId == null || Number.isNaN(Number(fileId)) ? null : Number(fileId);
  const sql = 'UPDATE player SET photo_id = ? WHERE id = ?';
  const params = [normalizedFileId, Number(playerId)];
  try {
    const [result] = await _originalQuery(sql, { replacements: params });
    const affected =
      result && (result.affectedRows || result.affected_rows || 0);
    return { ok: true, affected: Number(affected) || 0 };
  } catch (err) {
    err.code = err.code || 'EXTERNAL_DB_WHITELISTED_WRITE_FAILED';
    throw err;
  }
}

export async function deleteExternalFileById(fileId) {
  if (!externalDbAvailable)
    throw Object.assign(new Error('External DB unavailable'), {
      code: 'EXTERNAL_DB_UNAVAILABLE',
    });
  if (
    fileId == null ||
    (typeof fileId !== 'number' && typeof fileId !== 'string') ||
    Number.isNaN(Number(fileId))
  )
    throw new Error('Invalid fileId');
  const sql = 'DELETE FROM file WHERE id = ?';
  const params = [Number(fileId)];
  try {
    const [result] = await _originalQuery(sql, { replacements: params });
    const affected =
      result && (result.affectedRows || result.affected_rows || 0);
    return { ok: true, affected: Number(affected) || 0 };
  } catch (err) {
    err.code = err.code || 'EXTERNAL_DB_WHITELISTED_WRITE_FAILED';
    throw err;
  }
}
