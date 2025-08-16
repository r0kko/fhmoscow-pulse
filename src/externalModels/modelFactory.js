import { one, many } from './base.js';

/**
 * Create a thin, read‑focused model for a table in the external MariaDB.
 * - Always parameterizes queries
 * - Safely quotes table/column identifiers
 * - Optionally validates row shape with a Joi schema
 */
export function createModel({
  table,
  primaryKey = 'id',
  schema = null,
  defaultSelect = '*',
}) {
  const t = safeIdent(table);
  const pk = safeIdent(primaryKey);
  const select = defaultSelect;

  return {
    table,
    primaryKey,
    async findById(id) {
      return one(
        `SELECT ${select} FROM ${t} WHERE ${pk} = ? LIMIT 1`,
        [id],
        schema
      );
    },
    async listAll({ limit = 100, offset = 0 } = {}) {
      return many(
        `SELECT ${select} FROM ${t} ORDER BY ${pk} ASC LIMIT ? OFFSET ?`,
        [Number(limit) || 100, Number(offset) || 0],
        schema
      );
    },
    async findOne(whereSql, params = []) {
      return one(
        `SELECT ${select} FROM ${t} WHERE ${whereSql} LIMIT 1`,
        params,
        schema
      );
    },
    async listWhere(
      whereSql = '1',
      params = [],
      { orderBy = null, limit = 100, offset = 0 } = {}
    ) {
      const order = orderBy ? ` ORDER BY ${orderBy}` : '';
      return many(
        `SELECT ${select} FROM ${t} WHERE ${whereSql}${order} LIMIT ? OFFSET ?`,
        [...params, Number(limit) || 100, Number(offset) || 0],
        schema
      );
    },
    async listBy(field, value, opts = {}) {
      const col = safeIdent(field);
      return this.listWhere(`${col} = ?`, [value], opts);
    },
  };
}

function safeIdent(name) {
  // Basic identifier quoting to guard reserved words like `group`
  if (typeof name !== 'string' || !name) throw new Error('Identifier required');
  // Allow dotted identifiers (schema.table) and backticks within are stripped
  return name
    .split('.')
    .map((part) => `\`${String(part).replaceAll('`', '')}\``)
    .join('.');
}

export default { createModel };
