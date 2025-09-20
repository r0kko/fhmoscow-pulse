import { escapeHtml } from '../../utils/html.js';

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function heading(text, options = {}) {
  return {
    type: 'heading',
    text,
    level: options.level || 2,
    align: options.align,
  };
}

export function paragraph(text, options = {}) {
  return {
    type: 'paragraph',
    text,
    align: options.align,
    emphasis: options.emphasis || false,
    html: options.html || false,
  };
}

export function lead(text, options = {}) {
  return {
    type: 'lead',
    text,
    align: options.align,
    html: options.html || false,
  };
}

export function button(label, url, options = {}) {
  return {
    type: 'button',
    label,
    url,
    variant: options.variant || 'primary',
    fullWidth: Boolean(options.fullWidth),
  };
}

export function code(codeText, options = {}) {
  return {
    type: 'code',
    value: String(codeText || ''),
    label: options.label,
  };
}

export function spacer(size = 16) {
  return { type: 'spacer', size };
}

export function divider() {
  return { type: 'divider' };
}

export function list(items, options = {}) {
  return {
    type: 'list',
    ordered: Boolean(options.ordered),
    items: ensureArray(items).map((item) =>
      typeof item === 'string' ? { text: item } : item
    ),
  };
}

export function infoGrid(rows, options = {}) {
  return {
    type: 'keyValue',
    rows: ensureArray(rows).map((row) => ({
      label: row.label,
      value: row.value,
      allowHtml: Boolean(row.allowHtml),
    })),
    columnGap: options.columnGap || 16,
  };
}

export function table(columns, rows, options = {}) {
  return {
    type: 'table',
    columns: columns.map((col) => ({
      key: col.key,
      title: col.title,
      align: col.align || 'left',
      width: col.width,
      allowHtml: Boolean(col.allowHtml),
    })),
    rows: rows.map((row) => {
      if (Array.isArray(row)) {
        return row.map((cell) =>
          typeof cell === 'object' ? cell : { text: cell }
        );
      }
      const cells = [];
      for (const col of columns) {
        const value = row[col.key];
        if (value && typeof value === 'object' && value !== null) {
          cells.push(value);
        } else {
          cells.push({ text: value });
        }
      }
      return cells;
    }),
    zebra: options.zebra !== false,
    compact: options.compact || false,
  };
}

export function rawHtmlBlock(html) {
  return { type: 'raw', html };
}

export function textForBlock(block) {
  switch (block.type) {
    case 'heading':
    case 'lead':
    case 'paragraph':
      return block.text || '';
    case 'code':
      return block.value || '';
    case 'button':
      return `${block.label}: ${block.url}`;
    case 'list':
      return block.items.map((x) => x.text || '').join('\n');
    case 'keyValue':
      return block.rows.map((row) => `${row.label}: ${row.value}`).join('\n');
    case 'table':
      return block.rows
        .map((row) =>
          row
            .map((cell) => {
              if (cell.text) return cell.text;
              if (cell.label && cell.url) return `${cell.label}: ${cell.url}`;
              if (cell.value) return cell.value;
              if (cell.html) return cell.html;
              return '';
            })
            .join(' | ')
        )
        .join('\n');
    default:
      return '';
  }
}

export function link(label, url) {
  return { type: 'link', label, url };
}

export function formatText(value, allowHtml = false) {
  if (value === null || value === undefined) return '';
  return allowHtml ? String(value) : escapeHtml(String(value));
}

export default {
  heading,
  paragraph,
  lead,
  button,
  code,
  spacer,
  divider,
  list,
  infoGrid,
  table,
  rawHtmlBlock,
  link,
  textForBlock,
  formatText,
};
