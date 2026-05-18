import PDFDocument from 'pdfkit';

import {
  applyFonts,
  applyFirstPageHeader,
  applyFooter,
  applyESignStamp,
} from '../../utils/pdf.js';

const TITLE = 'Акт об оказании услуг';
const SUBTITLE = 'Спортивного судьи Федерации хоккея Москвы';
const TABLE_HEADER_FILL = '#F4F6F9';
const TABLE_BORDER = '#C9D1DB';
const TEXT_MUTED = '#6B7280';
const TEXT_PRIMARY = '#111827';
const TABLE_BOTTOM_GAP = 88;
const CLAIM_TEXT =
  'Вышеперечисленные услуги оказаны полностью и в срок. Заказчик претензий по объему, качеству и срокам оказания услуг не имеет.';

function normalizeText(value, fallback = '—') {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function formatDateLong(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const monthNames = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ];
  return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()} г.`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  });
}

function formatRub(value) {
  const number = Number(String(value ?? 0).replace(',', '.'));
  if (!Number.isFinite(number)) return '0,00';
  return number.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function signerLabel(signature, fallback = '—') {
  const fio = [
    signature?.last_name,
    signature?.first_name,
    signature?.patronymic,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fio || normalizeText(signature?.full_name, fallback);
}

function formatTitle(meta = {}) {
  if (!meta?.number) return TITLE;
  return `${TITLE} № ${meta.number}`;
}

function formatPartyName(party, fallback = '—') {
  return party?.full_name || party?.name || party?.short_name || fallback;
}

function splitLongToken(doc, token, width) {
  if (!token) return '';
  if (doc.widthOfString(token) <= width) return token;

  const chunks = [];
  let current = '';
  for (const symbol of token) {
    const next = `${current}${symbol}`;
    if (current && doc.widthOfString(next) > width) {
      chunks.push(current);
      current = symbol;
      continue;
    }
    current = next;
  }
  if (current) chunks.push(current);
  return chunks.join('\n');
}

function wrapWordsToLines(doc, text, width, { splitLongTokens = false } = {}) {
  const tokens = String(text || '')
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return ['—'];

  const lines = [];
  let currentLine = '';

  for (const token of tokens) {
    const pieces =
      splitLongTokens && doc.widthOfString(token) > width
        ? splitLongToken(doc, token, width).split('\n').filter(Boolean)
        : [token];

    for (const [pieceIndex, piece] of pieces.entries()) {
      if (pieceIndex > 0 && currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }

      const candidate = currentLine ? `${currentLine} ${piece}` : piece;
      if (!currentLine || doc.widthOfString(candidate) <= width) {
        currentLine = candidate;
        continue;
      }
      lines.push(currentLine);
      currentLine = piece;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function wrapCellText(doc, value, width, fallback = '—') {
  const text = normalizeText(value, '');
  if (!text) return fallback === '' ? '' : fallback;

  return text
    .split('\n')
    .map((line) =>
      line
        .split(/\s+/)
        .map((token) => splitLongToken(doc, token, width))
        .join(' ')
        .trim()
    )
    .join('\n');
}

function fitRoleCellText(
  doc,
  value,
  width,
  { baseFontSize = 9, minFontSize = 7.6, step = 0.2 } = {}
) {
  const lineHeightRatio = 1.12;
  const text = normalizeText(value, '—');
  if (text === '—') {
    return {
      text,
      lines: [text],
      fontSize: baseFontSize,
      lineHeight: Math.ceil(baseFontSize * lineHeightRatio),
    };
  }

  const lines = text.split('\n').map((line) => normalizeText(line, ''));
  let fontSize = baseFontSize;

  while (fontSize > minFontSize) {
    doc.fontSize(fontSize);
    const longestTokenFits = lines.every((line) =>
      line
        .split(/\s+/)
        .filter(Boolean)
        .every((token) => doc.widthOfString(token) <= width)
    );
    if (longestTokenFits) {
      const wrappedLines = lines.flatMap((line) =>
        wrapWordsToLines(doc, line, width)
      );
      return {
        text: wrappedLines.join('\n'),
        lines: wrappedLines,
        fontSize,
        lineHeight: Math.ceil(fontSize * lineHeightRatio),
      };
    }
    fontSize = Number((fontSize - step).toFixed(2));
  }

  doc.fontSize(minFontSize);
  const wrappedLines = lines.flatMap((line) =>
    wrapWordsToLines(doc, line, width, { splitLongTokens: true })
  );
  return {
    text: wrappedLines.join('\n'),
    lines: wrappedLines,
    fontSize: minFontSize,
    lineHeight: Math.ceil(minFontSize * lineHeightRatio),
  };
}

function roleLayoutHeight(roleLayout) {
  return Math.max(
    roleLayout.lineHeight,
    roleLayout.lines.length * roleLayout.lineHeight
  );
}

function formatPartyDetails(party) {
  return [
    party?.inn ? `ИНН ${party.inn}` : null,
    party?.kpp ? `КПП ${party.kpp}` : null,
    party?.address || null,
  ]
    .filter(Boolean)
    .join(', ');
}

function getContentBounds(doc) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  return {
    left,
    right,
    width: right - left,
    bottom: doc.page.height - doc.page.margins.bottom,
  };
}

function ensurePageSpace(doc, fonts, meta, neededHeight, y = doc.y) {
  const { bottom } = getContentBounds(doc);
  if (y + neededHeight <= bottom) return false;
  doc.addPage();
  drawPageHeading(doc, fonts, meta, { showDocumentTitle: false });
  return true;
}

function buildIntroText(contract) {
  const number = normalizeText(contract?.number, '');
  const date = formatDateLong(contract?.document_date);
  const fragments = [
    'В соответствии с заявлением о присоединении к условиям договора оказания услуг по судейству',
    number ? `№ ${number}` : null,
    date ? `от ${date}` : null,
    'Исполнитель оказал следующие услуги:',
  ].filter(Boolean);
  return fragments.join(' ');
}

function sectionDivider(doc, y) {
  doc
    .save()
    .lineWidth(0.8)
    .strokeColor(TABLE_BORDER)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke()
    .restore();
}

function drawPageHeading(doc, fonts, meta, { showDocumentTitle = true } = {}) {
  applyFirstPageHeader(doc);
  doc.y = 74;
  if (!showDocumentTitle) {
    doc.moveDown(0.15);
    return;
  }
  doc
    .font(fonts.bold)
    .fontSize(18.5)
    .fillColor(TEXT_PRIMARY)
    .text(formatTitle(meta), {
      align: 'center',
    });
  doc.moveDown(0.1);
  doc.font(fonts.regular).fontSize(10.5).fillColor(TEXT_MUTED).text(SUBTITLE, {
    align: 'center',
  });
  doc.moveDown(0.55);
}

function drawPartySection(doc, fonts, meta, label, party) {
  const { left, width } = getContentBounds(doc);
  const labelWidth = 92;
  const valueWidth = width - labelWidth - 18;
  const valueLeft = left + labelWidth + 18;
  const details = wrapCellText(
    doc.font(fonts.regular).fontSize(10),
    formatPartyDetails(party),
    valueWidth,
    ''
  );
  const name = wrapCellText(
    doc.font(fonts.bold).fontSize(10),
    formatPartyName(party),
    valueWidth
  );
  const nameHeight = doc
    .font(fonts.bold)
    .fontSize(10)
    .heightOfString(name, { width: valueWidth });
  const detailsHeight = details
    ? doc
        .font(fonts.regular)
        .fontSize(10)
        .heightOfString(details, { width: valueWidth })
    : 0;
  ensurePageSpace(doc, fonts, meta, nameHeight + detailsHeight + 18);

  const top = doc.y;
  doc
    .font(fonts.bold)
    .fontSize(10)
    .fillColor(TEXT_PRIMARY)
    .text(label, left, top, {
      width: labelWidth,
    });
  doc
    .font(fonts.bold)
    .fontSize(10)
    .fillColor(TEXT_PRIMARY)
    .text(name, valueLeft, top, {
      width: valueWidth,
    });
  let nextY = Math.max(
    doc.y,
    top + doc.heightOfString(name, { width: valueWidth })
  );
  if (details) {
    doc
      .font(fonts.regular)
      .fontSize(10)
      .fillColor(TEXT_PRIMARY)
      .text(details, valueLeft, nextY + 2, {
        width: valueWidth,
      });
    nextY = Math.max(
      doc.y,
      nextY + 2 + doc.heightOfString(details, { width: valueWidth })
    );
  }
  doc.y = nextY + 10;
}

function bankAccountRows(bankAccount) {
  if (!bankAccount?.number || !bankAccount?.bic) return [];
  return [
    ['р/с', bankAccount.number],
    ['Банк', bankAccount.bank_name],
    ['БИК', bankAccount.bic],
    ['к/с', bankAccount.correspondent_account],
    ['ИНН банка', bankAccount.inn],
    ['КПП банка', bankAccount.kpp],
    ['Адрес банка', bankAccount.address],
  ]
    .filter(([, value]) => normalizeText(value, ''))
    .map(([label, value]) => ({
      label,
      value: normalizeText(value, ''),
    }));
}

function wrapBankValue(doc, value, width) {
  const text = normalizeText(value, '');
  if (!text) return '';
  if (/^\d{9,20}$/.test(text) && doc.widthOfString(text) <= width) {
    return text;
  }
  return wrapCellText(doc, text, width, '');
}

function drawBankAccountSection(doc, fonts, meta, bankAccount) {
  const rows = bankAccountRows(bankAccount);
  if (!rows.length) return;

  const { left, width } = getContentBounds(doc);
  const labelWidth = 72;
  const valueWidth = width - labelWidth - 18;
  const rowHeights = rows.map((row) => {
    const valueText = wrapBankValue(
      doc.font(fonts.regular).fontSize(8.9),
      row.value,
      valueWidth
    );
    return Math.max(
      14,
      doc
        .font(fonts.regular)
        .fontSize(8.9)
        .heightOfString(valueText, { width: valueWidth, lineGap: 0 }) + 2
    );
  });
  const totalHeight =
    18 + rowHeights.reduce((sum, value) => sum + value, 0) + 8;
  ensurePageSpace(doc, fonts, meta, totalHeight);

  let y = doc.y;
  doc
    .font(fonts.bold)
    .fontSize(9.7)
    .fillColor(TEXT_PRIMARY)
    .text('Банковские реквизиты исполнителя', left, y, { width });
  y += 18;

  for (const [index, row] of rows.entries()) {
    const rowHeight = rowHeights[index];
    const valueText = wrapBankValue(
      doc.font(fonts.regular).fontSize(8.9),
      row.value,
      valueWidth
    );
    doc
      .font(fonts.bold)
      .fontSize(8.6)
      .fillColor(TEXT_MUTED)
      .text(row.label, left, y, {
        width: labelWidth,
        lineBreak: false,
      });
    doc
      .font(fonts.regular)
      .fontSize(8.9)
      .fillColor(TEXT_PRIMARY)
      .text(valueText, left + labelWidth + 18, y, {
        width: valueWidth,
        lineGap: 0,
      });
    y += rowHeight;
  }

  doc.y = y + 8;
}

function drawTableHeader(doc, fonts, columns, y) {
  let x = doc.page.margins.left;
  const headerHeight = 34;
  for (const column of columns) {
    doc
      .save()
      .fillColor(TABLE_HEADER_FILL)
      .rect(x, y, column.width, headerHeight)
      .fill()
      .restore();
    doc
      .save()
      .lineWidth(0.8)
      .strokeColor(TABLE_BORDER)
      .rect(x, y, column.width, headerHeight)
      .stroke()
      .restore();
    const textOptions = {
      width: column.width - 12,
      align: 'center',
    };
    const textHeight = doc
      .font(fonts.bold)
      .fontSize(9)
      .heightOfString(column.label, textOptions);
    doc
      .font(fonts.bold)
      .fontSize(9)
      .fillColor(TEXT_PRIMARY)
      .text(
        column.label,
        x + 6,
        y + Math.max(8, (headerHeight - textHeight) / 2),
        textOptions
      );
    x += column.width;
  }
  return y + headerHeight;
}

function calcRowHeight(doc, fonts, item, columns) {
  doc.font(fonts.regular).fontSize(9.2);
  const matchLabel = wrapCellText(doc, item.match_label, columns[2].width - 12);
  doc.font(fonts.regular).fontSize(8.2);
  const competitionName = wrapCellText(
    doc,
    item.competition_name,
    columns[2].width - 12,
    ''
  );
  doc.font(fonts.regular).fontSize(9);
  const serviceDateTime = wrapCellText(
    doc,
    item.service_datetime,
    columns[1].width - 12
  );
  const roleLayout = fitRoleCellText(
    doc.font(fonts.regular).fontSize(9),
    item.role_name,
    columns[3].width - 12
  );
  const tariffLabel = wrapCellText(
    doc.font(fonts.regular).fontSize(9),
    item.tariff_label,
    columns[4].width - 12
  );
  const matchHeight =
    doc
      .font(fonts.regular)
      .fontSize(9.2)
      .heightOfString(matchLabel, {
        width: columns[2].width - 12,
        lineGap: 0,
      }) +
    doc
      .font(fonts.regular)
      .fontSize(8.2)
      .heightOfString(competitionName, {
        width: columns[2].width - 12,
        lineGap: 0,
      });

  return Math.max(
    34,
    doc
      .font(fonts.regular)
      .fontSize(9)
      .heightOfString(serviceDateTime, {
        width: columns[1].width - 12,
        lineGap: 0,
      }) + 10,
    matchHeight + 14,
    roleLayoutHeight(roleLayout) + 10,
    doc
      .font(fonts.regular)
      .fontSize(9)
      .heightOfString(tariffLabel, {
        width: columns[4].width - 12,
        lineGap: 0,
      }) + 10
  );
}

function drawTableRow(doc, fonts, item, columns, y) {
  const rowHeight = calcRowHeight(doc, fonts, item, columns);
  let x = doc.page.margins.left;
  const serviceDateTime = wrapCellText(
    doc.font(fonts.regular).fontSize(9),
    item.service_datetime,
    columns[1].width - 12
  );
  const matchLabel = wrapCellText(
    doc.font(fonts.regular).fontSize(9.2),
    item.match_label,
    columns[2].width - 12
  );
  const competitionName = wrapCellText(
    doc.font(fonts.regular).fontSize(8.2),
    item.competition_name,
    columns[2].width - 12,
    ''
  );
  const roleLayout = fitRoleCellText(
    doc.font(fonts.regular).fontSize(9),
    item.role_name,
    columns[3].width - 12
  );
  const tariffLabel = wrapCellText(
    doc.font(fonts.regular).fontSize(9),
    item.tariff_label,
    columns[4].width - 12
  );

  for (const column of columns) {
    doc
      .save()
      .lineWidth(0.8)
      .strokeColor(TABLE_BORDER)
      .rect(x, y, column.width, rowHeight)
      .stroke()
      .restore();
    x += column.width;
  }

  x = doc.page.margins.left;
  const numberHeight = doc
    .font(fonts.regular)
    .fontSize(9.2)
    .heightOfString(String(item.line_no || ''), {
      width: columns[0].width - 12,
      align: 'center',
      lineGap: 0,
    });
  doc
    .font(fonts.regular)
    .fontSize(9.2)
    .fillColor(TEXT_PRIMARY)
    .text(
      String(item.line_no || ''),
      x + 6,
      y + Math.max(8, (rowHeight - numberHeight) / 2),
      {
        width: columns[0].width - 12,
        align: 'center',
        lineGap: 0,
      }
    );
  x += columns[0].width;

  const serviceDateHeight = doc
    .font(fonts.regular)
    .fontSize(9)
    .heightOfString(serviceDateTime, {
      width: columns[1].width - 12,
      lineGap: 0,
    });
  doc
    .font(fonts.regular)
    .fontSize(9)
    .fillColor(TEXT_PRIMARY)
    .text(
      serviceDateTime,
      x + 6,
      y + Math.max(8, (rowHeight - serviceDateHeight) / 2),
      {
        width: columns[1].width - 12,
        lineGap: 0,
      }
    );
  x += columns[1].width;

  const matchHeight = doc
    .font(fonts.regular)
    .fontSize(9.2)
    .heightOfString(matchLabel, {
      width: columns[2].width - 12,
      lineGap: 0,
    });
  const competitionHeight = doc
    .font(fonts.regular)
    .fontSize(8.2)
    .heightOfString(competitionName, {
      width: columns[2].width - 12,
      lineGap: 0,
    });
  const matchBlockY =
    y + Math.max(8, (rowHeight - (matchHeight + competitionHeight + 2)) / 2);
  doc
    .font(fonts.regular)
    .fontSize(9.2)
    .fillColor(TEXT_PRIMARY)
    .text(matchLabel, x + 6, matchBlockY, {
      width: columns[2].width - 12,
      lineGap: 0,
    });
  const competitionY = matchBlockY + matchHeight;
  doc
    .font(fonts.regular)
    .fontSize(8.2)
    .fillColor(TEXT_MUTED)
    .text(competitionName, x + 6, competitionY + 2, {
      width: columns[2].width - 12,
      lineGap: 0,
    });
  x += columns[2].width;

  const roleHeight = roleLayoutHeight(roleLayout);
  const roleTop = y + Math.max(8, (rowHeight - roleHeight) / 2);
  doc.font(fonts.regular).fontSize(roleLayout.fontSize).fillColor(TEXT_PRIMARY);
  for (const [lineIndex, line] of roleLayout.lines.entries()) {
    doc.text(line, x + 6, roleTop + lineIndex * roleLayout.lineHeight, {
      width: columns[3].width - 12,
      lineBreak: false,
      lineGap: 0,
    });
  }
  x += columns[3].width;

  const tariffHeight = doc
    .font(fonts.regular)
    .fontSize(9)
    .heightOfString(tariffLabel, {
      width: columns[4].width - 12,
      align: 'center',
      lineGap: 0,
    });
  doc
    .font(fonts.regular)
    .fontSize(9)
    .fillColor(TEXT_PRIMARY)
    .text(tariffLabel, x + 6, y + Math.max(8, (rowHeight - tariffHeight) / 2), {
      width: columns[4].width - 12,
      align: 'center',
      lineGap: 0,
    });
  x += columns[4].width;

  const amountText = formatRub(item.amount_rub || item.total_amount_rub);
  const amountHeight = doc
    .font(fonts.bold)
    .fontSize(9.2)
    .heightOfString(amountText, {
      width: columns[5].width - 12,
      align: 'right',
      lineGap: 0,
    });
  doc
    .font(fonts.bold)
    .fontSize(9.2)
    .fillColor(TEXT_PRIMARY)
    .text(amountText, x + 6, y + Math.max(8, (rowHeight - amountHeight) / 2), {
      width: columns[5].width - 12,
      align: 'right',
      lineGap: 0,
    });

  return y + rowHeight;
}

function ensureTablePage(doc, fonts, columns, y, nextRowHeight) {
  const limit = doc.page.height - doc.page.margins.bottom - TABLE_BOTTOM_GAP;
  if (y + nextRowHeight <= limit) return y;
  doc.addPage();
  drawPageHeading(doc, fonts, {}, { showDocumentTitle: false });
  return drawTableHeader(doc, fonts, columns, doc.y + 2);
}

function estimateSummaryHeight(doc, fonts, totals = {}) {
  const { width } = getContentBounds(doc);
  const countLine = `Всего наименований ${Number(
    totals.items_count || 0
  )}, на сумму ${formatRub(totals.total_amount_rub)} рублей`;
  return (
    28 * 3 +
    16 +
    doc.font(fonts.regular).fontSize(10).heightOfString(countLine, { width }) +
    4 +
    doc
      .font(fonts.bold)
      .fontSize(10)
      .heightOfString(normalizeText(totals.total_amount_words), { width }) +
    3 +
    doc
      .font(fonts.bold)
      .fontSize(10)
      .heightOfString(totals.vat_label || 'Без налога (НДС)', { width }) +
    8
  );
}

function drawSummary(doc, fonts, totals = {}) {
  const contentLeft = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const boxWidth = 196;
  const valueWidth = 78;
  const boxLeft = doc.page.width - doc.page.margins.right - boxWidth;
  const rows = [
    { label: 'Итого', value: formatRub(totals.total_amount_rub) },
    { label: totals.vat_label || 'Без налога (НДС)', value: '—' },
    { label: 'Всего к оплате', value: formatRub(totals.total_amount_rub) },
  ];
  let y = doc.y;

  for (const row of rows) {
    doc
      .font(fonts.bold)
      .fontSize(9.3)
      .fillColor(TEXT_PRIMARY)
      .text(row.label, boxLeft, y + 7, {
        width: boxWidth - valueWidth - 8,
        align: 'right',
      });
    doc
      .save()
      .lineWidth(0.8)
      .strokeColor(TABLE_BORDER)
      .rect(boxLeft + boxWidth - valueWidth, y, valueWidth, 28)
      .stroke()
      .restore();
    doc
      .font(fonts.bold)
      .fontSize(9.3)
      .fillColor(TEXT_PRIMARY)
      .text(row.value, boxLeft + boxWidth - valueWidth + 6, y + 7, {
        width: valueWidth - 12,
        align: 'right',
      });
    y += 28;
  }

  doc.y = y + 16;
  doc
    .font(fonts.regular)
    .fontSize(10)
    .fillColor(TEXT_PRIMARY)
    .text(
      `Всего наименований ${Number(totals.items_count || 0)}, на сумму ${formatRub(
        totals.total_amount_rub
      )} рублей`,
      contentLeft,
      doc.y,
      {
        width: contentWidth,
      }
    );
  doc.moveDown(0.15);
  doc
    .font(fonts.bold)
    .fontSize(10)
    .fillColor(TEXT_PRIMARY)
    .text(normalizeText(totals.total_amount_words), contentLeft, doc.y, {
      width: contentWidth,
    });
  doc.moveDown(0.08);
  doc
    .font(fonts.bold)
    .fontSize(10)
    .fillColor(TEXT_PRIMARY)
    .text(totals.vat_label || 'Без налога (НДС)', contentLeft, doc.y, {
      width: contentWidth,
    });
}

function signatureLaneMetrics(doc, fonts, customer, performer, signatures) {
  const { width } = getContentBounds(doc);
  const gap = 16;
  const laneWidth = Math.floor((width - gap) / 2);
  const titleHeight = doc
    .font(fonts.bold)
    .fontSize(9.6)
    .heightOfString('Заказчик', { width: laneWidth });
  const customerHeight = doc
    .font(fonts.regular)
    .fontSize(8.6)
    .heightOfString(formatPartyName(customer), { width: laneWidth });
  const performerHeight = doc
    .font(fonts.regular)
    .fontSize(8.6)
    .heightOfString(formatPartyName(performer), { width: laneWidth });
  const metaHeight =
    titleHeight + 3 + Math.max(customerHeight, performerHeight);
  const stampTopOffset = Math.max(42, metaHeight + 12);
  const hasFhmoSignature = signatures.some((item) => item.party === 'FHMO');
  const hasRefereeSignature = signatures.some(
    (item) => item.party === 'REFEREE'
  );
  const stampHeight = Math.max(
    hasFhmoSignature ? 82 : 0,
    hasRefereeSignature ? 68 : 0,
    34
  );
  return {
    laneWidth,
    metaHeight,
    stampTopOffset,
    height: stampTopOffset + stampHeight + 8,
  };
}

function estimateClaimAndSignatureHeight(
  doc,
  fonts,
  customer,
  performer,
  signatures
) {
  const { width } = getContentBounds(doc);
  return (
    8 +
    doc.font(fonts.regular).fontSize(10).heightOfString(CLAIM_TEXT, {
      width,
      align: 'justify',
    }) +
    14 +
    signatureLaneMetrics(doc, fonts, customer, performer, signatures).height
  );
}

async function drawSignatureLane(
  doc,
  fonts,
  meta,
  customer,
  performer,
  signatures,
  signerSnapshot
) {
  const { left } = getContentBounds(doc);
  const gap = 16;
  const { laneWidth, stampTopOffset } = signatureLaneMetrics(
    doc,
    fonts,
    customer,
    performer,
    signatures
  );
  const laneTop = doc.y;
  const fhmoSignature =
    signatures.find((item) => item.party === 'FHMO') || null;
  const refereeSignature =
    signatures.find((item) => item.party === 'REFEREE') || null;

  const drawLaneMeta = (x, title, person) => {
    const titleHeight = doc
      .font(fonts.bold)
      .fontSize(9.6)
      .heightOfString(title, { width: laneWidth });
    doc
      .font(fonts.bold)
      .fontSize(9.6)
      .fillColor(TEXT_PRIMARY)
      .text(title, x, laneTop, { width: laneWidth });
    doc
      .font(fonts.regular)
      .fontSize(8.6)
      .fillColor(TEXT_MUTED)
      .text(person, x, laneTop + titleHeight + 3, { width: laneWidth });
  };

  drawLaneMeta(left, 'Заказчик', formatPartyName(customer));
  drawLaneMeta(
    left + laneWidth + gap,
    'Исполнитель',
    formatPartyName(performer)
  );

  const stampY = laneTop + stampTopOffset;
  const fhmoStampHeight = 82;
  const refereeStampHeight = 68;
  let fhmoStamp = null;
  let refereeStamp = null;

  if (fhmoSignature) {
    fhmoStamp = await applyESignStamp(doc, {
      x: left,
      y: stampY,
      maxWidth: laneWidth,
      stampHeight: fhmoStampHeight,
      footerBandHeight: 0,
      fio:
        signerLabel(fhmoSignature) ||
        signerSnapshot?.full_name ||
        'Уполномоченный представитель ФХМ',
      signedAt: fhmoSignature.created_at,
      userId: fhmoSignature.user_id,
      signerPosition:
        fhmoSignature.position || signerSnapshot?.position || null,
      signerDepartment:
        fhmoSignature.department || signerSnapshot?.department || null,
      signerOrganization:
        fhmoSignature.organization || signerSnapshot?.organization || null,
      docId: meta.docId,
      signId: fhmoSignature.sign_id,
      page: meta.page,
      total: meta.total,
    });
  }

  if (refereeSignature) {
    refereeStamp = await applyESignStamp(doc, {
      x: left + laneWidth + gap,
      y: stampY,
      maxWidth: laneWidth,
      stampHeight: refereeStampHeight,
      showPageInfo: false,
      footerBandHeight: 0,
      showSignerDepartment: false,
      showSignerOrganization: false,
      fio:
        signerLabel(refereeSignature) || performer?.full_name || 'Исполнитель',
      signedAt: refereeSignature.created_at,
      userId: refereeSignature.user_id,
      signerPosition: 'Спортивный судья',
      signerOrganization: 'Федерация хоккея Москвы',
      docId: meta.docId,
      signId: refereeSignature.sign_id,
      page: meta.page,
      total: meta.total,
    });
  }

  const renderedStampHeight = Math.max(
    fhmoStampHeight,
    refereeStampHeight,
    Number(fhmoStamp?.height || 0),
    Number(refereeStamp?.height || 0)
  );
  doc.y = stampY + renderedStampHeight + 8;
}

export default async function buildRefereeClosingActPdf(
  payload = {},
  meta = {}
) {
  const chunks = [];
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 36, bottom: 80, left: 30, right: 30 },
    bufferPages: true,
    info: { Title: TITLE },
  });
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on('end', resolve));

  const fonts = applyFonts(doc);
  const customer = payload?.customer || payload?.customer_snapshot || {};
  const performer = payload?.performer || payload?.performer_snapshot || {};
  const contract = payload?.contract || payload?.contract_snapshot || null;
  const totals = payload?.totals || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const signerSnapshot =
    payload?.fhmo_signer || payload?.fhmo_signer_snapshot || null;
  const signatures = Array.isArray(meta?.signatures) ? meta.signatures : [];
  const contentLeft = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  drawPageHeading(doc, fonts, meta);
  drawPartySection(doc, fonts, meta, 'Исполнитель', performer);
  drawPartySection(doc, fonts, meta, 'Заказчик', customer);
  drawBankAccountSection(doc, fonts, meta, performer?.bank_account || null);
  sectionDivider(doc, doc.y - 2);
  doc.moveDown(0.35);
  ensurePageSpace(
    doc,
    fonts,
    meta,
    doc
      .font(fonts.regular)
      .fontSize(10)
      .heightOfString(buildIntroText(contract), {
        width: contentWidth,
        align: 'justify',
      }) + 12
  );
  doc
    .font(fonts.regular)
    .fontSize(10)
    .fillColor(TEXT_PRIMARY)
    .text(buildIntroText(contract), contentLeft, doc.y, {
      width: contentWidth,
      align: 'justify',
    });
  doc.moveDown(0.45);

  const columns = [
    { key: 'line_no', label: '№', width: 28, align: 'center' },
    { key: 'service_datetime', label: 'Дата и время', width: 84 },
    { key: 'match_label', label: 'Матч', width: 187 },
    { key: 'role_name', label: 'Амплуа', width: 96 },
    { key: 'tariff_label', label: 'Тариф', width: 60, align: 'center' },
    { key: 'amount_rub', label: 'Сумма', width: 80, align: 'right' },
  ];

  let cursorY = drawTableHeader(doc, fonts, columns, doc.y);
  for (const [index, item] of items.entries()) {
    const normalizedItem = {
      ...item,
      line_no: item?.line_no || index + 1,
      service_datetime:
        item?.service_datetime || formatDateTime(item?.match_date_snapshot),
      match_label: normalizeText(item?.match_label || item?.service_name, '—'),
      competition_name: normalizeText(item?.competition_name, ''),
      role_name: normalizeText(item?.role_name || item?.referee_role_name, '—'),
      tariff_label: normalizeText(item?.tariff_label, '—'),
      amount_rub: item?.amount_rub || item?.total_amount_rub || item?.price_rub,
    };
    cursorY = ensureTablePage(
      doc,
      fonts,
      columns,
      cursorY,
      calcRowHeight(doc, fonts, normalizedItem, columns)
    );
    cursorY = drawTableRow(doc, fonts, normalizedItem, columns, cursorY);
  }

  doc.y = cursorY + 16;
  ensurePageSpace(doc, fonts, meta, estimateSummaryHeight(doc, fonts, totals));

  drawSummary(doc, fonts, totals);
  doc.moveDown(0.4);
  ensurePageSpace(
    doc,
    fonts,
    meta,
    estimateClaimAndSignatureHeight(doc, fonts, customer, performer, signatures)
  );
  sectionDivider(doc, doc.y);
  doc.moveDown(0.65);
  doc
    .font(fonts.regular)
    .fontSize(10)
    .fillColor(TEXT_PRIMARY)
    .text(CLAIM_TEXT, contentLeft, doc.y, {
      width: contentWidth,
      align: 'justify',
    });
  doc.moveDown(0.7);

  const rangeBefore = doc.bufferedPageRange();
  await drawSignatureLane(
    doc,
    fonts,
    {
      docId: meta.docId,
      page: rangeBefore.count,
      total: rangeBefore.count,
    },
    customer,
    performer,
    signatures,
    signerSnapshot
  );

  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    await applyFooter(doc, {
      page: index + 1,
      total: range.count,
      barcodeText: meta?.docId || null,
      numberText: meta?.number || null,
    });
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}
