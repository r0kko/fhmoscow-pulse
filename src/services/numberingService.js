import { QueryTypes } from 'sequelize';

import sequelize from '../config/database.js';

const NUMBER_SCOPE_DOCUMENT = 'DOCUMENT';

const SCOPE_TABLE_CONFIG = {
  [NUMBER_SCOPE_DOCUMENT]: {
    tableName: 'documents',
    numberColumn: 'number',
    dateColumn: 'document_date',
  },
};

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function formatNumber(date, sequence) {
  const value = normalizeDate(date);
  const yy = String(value.getFullYear()).slice(-2);
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  return `${yy}.${mm}/${sequence}`;
}

async function nextScopedSequence(scope, date, transaction = null) {
  const config = SCOPE_TABLE_CONFIG[scope];
  if (!config) {
    throw new Error(`Unsupported number scope: ${scope}`);
  }

  const value = normalizeDate(date);
  const year = value.getFullYear();
  const month = value.getMonth() + 1;
  const rows = await sequelize.query(
    `WITH current_max AS (
       SELECT COALESCE(
         MAX(
           CASE
             WHEN ${config.numberColumn} ~ :pattern
               THEN CAST(split_part(${config.numberColumn}, '/', 2) AS INTEGER)
             ELSE 0
           END
         ),
         0
       ) AS max_seq
       FROM ${config.tableName}
       WHERE EXTRACT(YEAR FROM ${config.dateColumn}) = :year
         AND EXTRACT(MONTH FROM ${config.dateColumn}) = :month
     )
     INSERT INTO number_counters (
       scope,
       year,
       month,
       last_seq,
       created_at,
       updated_at
     )
     SELECT :scope, :year, :month, current_max.max_seq + 1, NOW(), NOW()
     FROM current_max
     ON CONFLICT (scope, year, month) DO UPDATE
     SET last_seq = GREATEST(
           number_counters.last_seq + 1,
           (SELECT max_seq + 1 FROM current_max)
         ),
         updated_at = NOW()
     RETURNING last_seq`,
    {
      replacements: {
        scope,
        year,
        month,
        pattern: '^[0-9]{2}\\.[0-9]{2}/[0-9]+$',
      },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  return Number.parseInt(String(rows?.[0]?.last_seq || ''), 10) || 1;
}

export async function nextDocumentNumber(date, transaction = null) {
  const value = normalizeDate(date);
  const next = await nextScopedSequence(
    NUMBER_SCOPE_DOCUMENT,
    value,
    transaction
  );
  return formatNumber(value, next);
}

export async function nextMatchProtocolNumber(date, transaction = null) {
  return nextDocumentNumber(date, transaction);
}

export default {
  NUMBER_SCOPE_DOCUMENT,
  nextDocumentNumber,
  nextMatchProtocolNumber,
};
