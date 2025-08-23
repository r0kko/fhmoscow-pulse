import { fn, col as column, where } from 'sequelize';

/**
 * Common ACTIVE/ARCHIVE filters for external DB, tolerant to case/whitespace.
 * @param {string} col - column name holding status (default: 'object_status')
 */
export function statusFilters(col = 'object_status') {
  const c = column(col);
  return {
    ACTIVE: where(fn('LOWER', fn('TRIM', c)), 'active'),
    ARCHIVE: where(fn('LOWER', fn('TRIM', c)), 'archive'),
  };
}

export default { statusFilters };
