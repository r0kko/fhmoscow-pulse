import { escapeHtml } from '../../utils/html.js';

import { formatText, textForBlock } from './blocks.js';
import { getTheme } from './theme.js';

function renderHeading(block, theme) {
  const level = Math.min(Math.max(block.level || 2, 1), 4);
  const fontSizes = { 1: 28, 2: 22, 3: 18, 4: 16 };
  const size = fontSizes[level] || 22;
  const align = block.align ? `text-align:${block.align};` : '';
  return `
    <h${level} style="font-size:${size}px;line-height:1.3;margin:0 0 16px;font-weight:600;color:${theme.textColor};${align}">
      ${formatText(block.text)}
    </h${level}>`;
}

function renderParagraph(block, theme) {
  const align = block.align ? `text-align:${block.align};` : '';
  const weight = block.emphasis ? 'font-weight:600;' : '';
  return `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${theme.textColor};${align}${weight}">
      ${block.html ? block.text : formatText(block.text)}
    </p>`;
}

function renderLead(block, theme) {
  const align = block.align ? `text-align:${block.align};` : '';
  return `
    <p style="margin:0 0 20px;font-size:18px;line-height:1.6;color:${theme.textColor};font-weight:500;${align}">
      ${block.html ? block.text : formatText(block.text)}
    </p>`;
}

function renderButton(block, theme) {
  const bg = block.variant === 'secondary' ? '#ffffff' : theme.brandColor;
  const color =
    block.variant === 'secondary' ? theme.brandColor : theme.buttonTextColor;
  const border =
    block.variant === 'secondary'
      ? `1px solid ${theme.brandColor}`
      : '1px solid transparent';
  const width = block.fullWidth ? 'width:100%;' : 'width:auto;';
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:${block.fullWidth ? '24px 0' : '32px auto'};${width}"><tr>
      <td align="center" style="border-radius:10px;" bgcolor="${bg}">
        <a href="${escapeHtml(block.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;line-height:1.2;color:${color};text-decoration:none;border-radius:10px;background:${bg};border:${border};">
          ${formatText(block.label)}
        </a>
      </td>
    </tr></table>`;
}

function renderCode(block, theme) {
  return `
    <div style="margin:16px 0;">
      ${block.label ? `<div style="font-size:14px;color:${theme.mutedTextColor};margin-bottom:4px;">${formatText(block.label)}</div>` : ''}
      <div style="background:${theme.codeBackground};color:${theme.codeTextColor};border-radius:12px;padding:16px 20px;font-family:${theme.monoFontFamily};font-size:22px;letter-spacing:4px;text-align:center;">
        ${formatText(block.value)}
      </div>
    </div>`;
}

function renderSpacer(block) {
  const size = Number(block.size) || 16;
  return `<div style="height:${size}px;line-height:${size}px;">&nbsp;</div>`;
}

function renderDivider(theme) {
  return `<div style="border-bottom:1px solid ${theme.dividerColor};margin:24px 0;"></div>`;
}

function renderList(block, theme) {
  const tag = block.ordered ? 'ol' : 'ul';
  const indent = block.ordered ? 'left' : 'left';
  const itemsHtml = block.items
    .map(
      (item) =>
        `<li style="margin-bottom:8px;">${item.html ? item.text : formatText(item.text)}</li>`
    )
    .join('');
  return `
    <${tag} style="margin:0 0 16px 20px;padding:0;color:${theme.textColor};font-size:16px;line-height:1.55;text-align:${indent};">
      ${itemsHtml}
    </${tag}>`;
}

function renderKeyValue(block, theme) {
  const rows = block.rows
    .map(
      (row) => `
        <tr>
          <td style="padding:6px 0 6px 0;font-size:14px;color:${theme.mutedTextColor};vertical-align:top;white-space:nowrap;">${formatText(row.label)}</td>
          <td style="padding:6px 0 6px ${block.columnGap || 16}px;font-size:16px;color:${theme.textColor};vertical-align:top;">${row.allowHtml ? row.value : formatText(row.value)}</td>
        </tr>`
    )
    .join('');
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
      ${rows}
    </table>`;
}

function renderTable(block, theme) {
  const header = block.columns
    .map(
      (col) => `
        <th style="padding:10px 12px;font-size:13px;font-weight:600;color:${theme.mutedTextColor};text-transform:uppercase;letter-spacing:0.04em;text-align:${col.align || 'left'};${col.width ? `width:${col.width};` : ''}">
          ${formatText(col.title)}
        </th>`
    )
    .join('');
  const rows = block.rows
    .map((row, idx) => {
      const bg =
        block.zebra !== false && idx % 2 === 1 ? '#F8FAFC' : 'transparent';
      const cells = row
        .map((cell, colIdx) => {
          const column = block.columns[colIdx] || {};
          if (cell?.type === 'button') {
            return `<td style="padding:12px;text-align:${column.align || 'left'};white-space:nowrap;">${renderInlineButton(cell, theme)}</td>`;
          }
          if (cell?.label && cell?.url) {
            return `<td style="padding:12px;font-size:15px;color:${theme.textColor};text-align:${column.align || 'left'};">${renderInlineLink(cell.label, cell.url, theme)}</td>`;
          }
          const value = cell?.allowHtml
            ? cell.html || cell.value || cell.text || ''
            : formatText(cell?.value ?? cell?.text ?? '');
          return `<td style="padding:${block.compact ? '8px' : '12px'};font-size:15px;color:${theme.textColor};text-align:${column.align || 'left'};">${value}</td>`;
        })
        .join('');
      return `<tr style="background:${bg};">${cells}</tr>`;
    })
    .join('');
  return `
    <div style="margin:0 0 20px;overflow:hidden;border:1px solid ${theme.dividerColor};border-radius:12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <thead style="background:#F1F5F9;">${header}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderInlineLink(label, url, theme) {
  return `<a href="${escapeHtml(url)}" target="_blank" style="color:${theme.linkColor};text-decoration:none;font-weight:500;">${formatText(label)}</a>`;
}

function renderInlineButton(cell, theme) {
  const label = formatText(cell.label);
  return `<a href="${escapeHtml(cell.url)}" target="_blank" style="display:inline-block;padding:8px 16px;background:${theme.brandColor};color:${theme.buttonTextColor};border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">${label}</a>`;
}

function renderRaw(block) {
  return block.html || '';
}

function blockToHtml(block, theme) {
  switch (block.type) {
    case 'heading':
      return renderHeading(block, theme);
    case 'paragraph':
      return renderParagraph(block, theme);
    case 'lead':
      return renderLead(block, theme);
    case 'button':
      return renderButton(block, theme);
    case 'code':
      return renderCode(block, theme);
    case 'spacer':
      return renderSpacer(block);
    case 'divider':
      return renderDivider(theme);
    case 'list':
      return renderList(block, theme);
    case 'keyValue':
      return renderKeyValue(block, theme);
    case 'table':
      return renderTable(block, theme);
    case 'raw':
      return renderRaw(block);
    default:
      return '';
  }
}

function blockToText(block) {
  return textForBlock(block);
}

function getDefaultFooter(theme) {
  const supportEmail =
    process.env.EMAIL_SUPPORT_CONTACT || 'support@fhmoscow.com';
  const supportEmailEscaped = escapeHtml(supportEmail);
  const supportEmailLabel = formatText(supportEmail);
  const brandName = formatText(theme.brandName);
  const contactHtml = `Если у вас возникли вопросы, пожалуйста, обратитесь в службу поддержки — <a href="mailto:${supportEmailEscaped}" style="color:${theme.linkColor};text-decoration:none;">${supportEmailLabel}</a>.`;
  const closingHtml = `С уважением, команда ${brandName}. Это письмо отправлено автоматически, поэтому не отвечайте на него.`;
  const html = `
        <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${theme.mutedTextColor};">${contactHtml}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:${theme.mutedTextColor};">${closingHtml}</p>`;
  const text =
    `Если у вас возникли вопросы, пожалуйста, обратитесь в службу поддержки — ${supportEmail}.` +
    '\n\n' +
    `С уважением, команда ${theme.brandName}. Это письмо отправлено автоматически, поэтому не отвечайте на него.`;
  return { html, text };
}

function buildFooter(theme, footerNote, defaultFooter) {
  if (footerNote) {
    return `
    <tr>
      <td style="padding:24px 32px;background:#F8FAFC;border-top:1px solid ${theme.dividerColor};text-align:center;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:${theme.mutedTextColor};">${formatText(
          footerNote,
          false
        )}</p>
      </td>
    </tr>`;
  }

  const content = defaultFooter || getDefaultFooter(theme);
  return `
    <tr>
      <td style="padding:24px 32px;background:#F8FAFC;border-top:1px solid ${theme.dividerColor};text-align:center;">
${content.html}
      </td>
    </tr>`;
}

function buildHeader(theme, brandName) {
  return `
    <tr>
      <td style="padding:28px 32px 12px;text-align:center;">
        <span style="display:inline-block;font-size:18px;font-weight:700;color:${theme.brandColor};letter-spacing:0.04em;text-transform:uppercase;">${formatText(brandName)}</span>
      </td>
    </tr>`;
}

function renderPreview(previewText) {
  if (!previewText) return '';
  return `
    <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(
      previewText
    )}</div>`;
}

function wrapHtml(contentHtml, options) {
  const theme = getTheme();
  const brandName = options.brandName || theme.brandName;
  const preview = renderPreview(options.previewText);
  const footer = buildFooter(theme, options.footerNote, options.defaultFooter);
  const header = buildHeader(theme, brandName);
  const containerWidth = theme.containerMaxWidth;
  return `
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.subject || theme.brandName)}</title>
</head>
<body style="margin:0;padding:0;background:${theme.backgroundColor};font-family:${theme.fontFamily};">
  ${preview}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${theme.backgroundColor};padding:24px 0;">
    <tr>
      <td align="center" style="padding:0 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:${containerWidth}px;background:${theme.containerBackground};border-radius:16px;border:1px solid ${theme.containerBorder};overflow:hidden;">
          ${header}
          <tr>
            <td style="padding:12px 32px 32px;">
              ${contentHtml}
            </td>
          </tr>
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailLayout({
  subject,
  previewText,
  blocks = [],
  footerNote,
}) {
  const theme = getTheme();
  const defaultFooter = getDefaultFooter(theme);
  const htmlBody = blocks.map((block) => blockToHtml(block, theme)).join('');
  const textBody = blocks
    .map((block) => blockToText(block))
    .filter(Boolean)
    .join('\n\n')
    .trim();

  const html = wrapHtml(htmlBody, {
    subject,
    previewText,
    footerNote,
    defaultFooter,
  });
  const textFooter = footerNote || defaultFooter.text;
  const text = [textBody, textFooter].filter(Boolean).join('\n\n').trim();

  return { html, text };
}

export function buildEmail({ subject, previewText, blocks = [], footerNote }) {
  const { html, text } = renderEmailLayout({
    subject,
    previewText,
    blocks,
    footerNote,
  });
  return { subject, html, text };
}

export default buildEmail;
