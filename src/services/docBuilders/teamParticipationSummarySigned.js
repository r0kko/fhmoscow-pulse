import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import PDFDocument from 'pdfkit';
import sharp from 'sharp';

import { PDF_LOGOS } from '../../config/pdf.js';
import ServiceError from '../../errors/ServiceError.js';
import { applyFonts } from '../../utils/pdf.js';

const SEAL_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../assets/fhm-protocol-seal.jpg'
);
const SIGNATURE_IMAGE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../assets/usanov-signature.png'
);

const PAGE_MARGIN = 34;
const TABLE_HEADER_HEIGHT = 154;
const ROW_HEIGHT = 14;
const SIGNATURE_RESERVED_HEIGHT = 86;
const NUMBER_WIDTH = 20;
const NAME_WIDTH = 150;
const BIRTH_WIDTH = 50;
const PERCENT_WIDTH = 44;
const MIN_TABLE_GAP = 12;
const LOGO_TOP = 18;
const FEDERATION_LOGO_HEIGHT = 30;
const SYSTEM_LOGO_WIDTH = 76;
const TITLE_TOP = 58;
const ROTATED_HEADER_PADDING = 1.2;
const ROTATED_HEADER_LINE_GAP = 0.7;
const MIN_ROTATED_TEXT_SCALE = 0.56;
const SIGNATURE_GAP = 28;
const SIGNATURE_BLOCK_HEIGHT = 74;

function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }).format(date);
}

function formatPercent(value) {
  return Number(value || 0)
    .toFixed(2)
    .replace('.', ',');
}

function percentFor(player, matches) {
  if (!matches.length) return 0;
  const played = matches.reduce(
    (sum, match) => sum + Number(player.cells?.[match.id] || 0),
    0
  );
  return (played / matches.length) * 100;
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength) {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text;
  if (maxLength <= 1) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function matchHeaderParts(match) {
  const date = formatDate(match.date_start);
  const home = normalizeText(match.home_team_name || 'Команда А');
  const away = normalizeText(match.away_team_name || 'Команда Б');
  return {
    date,
    pair: `${home} - ${away}`,
  };
}

function splitIntoChunks(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

function maxRowsPerPage(doc, headerHeight) {
  const available =
    doc.page.height -
    PAGE_MARGIN -
    headerHeight -
    TABLE_HEADER_HEIGHT -
    SIGNATURE_RESERVED_HEIGHT;
  return Math.max(1, Math.floor(available / ROW_HEIGHT));
}

function tableLayout(doc, matches) {
  const tableWidth = doc.page.width - PAGE_MARGIN * 2;
  const fixedWidth = NUMBER_WIDTH + NAME_WIDTH + BIRTH_WIDTH + PERCENT_WIDTH;
  const matchGroupWidth = Math.max(0, tableWidth - fixedWidth);
  const matchWidth = matches.length
    ? matchGroupWidth / matches.length
    : matchGroupWidth;
  return {
    tableWidth,
    matchGroupWidth,
    matchWidth,
    fixedWidth,
  };
}

function lineHeight(doc, font, size) {
  doc.font(font).fontSize(size);
  return doc.heightOfString('00.00.0000', {
    width: 200,
    lineBreak: false,
  });
}

function rotatedHeaderLayout(doc, parts, font, lineWidth, maxBlockHeight) {
  let dateSize = 4.6;
  let pairSize = 4.15;
  let gap = ROTATED_HEADER_LINE_GAP;

  while (pairSize > 2.8) {
    const dateHeight = lineHeight(doc, font, dateSize);
    const pairHeight = lineHeight(doc, font, pairSize);
    const blockHeight = dateHeight + gap + pairHeight;
    doc.font(font).fontSize(pairSize);
    const pairTextWidth = Math.max(0.01, doc.widthOfString(parts.pair));
    const pairScale = Math.min(1, lineWidth / pairTextWidth);
    if (blockHeight <= maxBlockHeight && pairScale >= MIN_ROTATED_TEXT_SCALE) {
      return {
        dateSize,
        pairSize,
        dateHeight,
        pairHeight,
        gap,
        blockHeight,
      };
    }
    dateSize = Math.max(3.4, dateSize - 0.08);
    pairSize -= 0.08;
    gap = Math.max(0.35, gap - 0.02);
  }

  const dateHeight = lineHeight(doc, font, dateSize);
  const pairHeight = lineHeight(doc, font, pairSize);
  return {
    dateSize,
    pairSize,
    dateHeight,
    pairHeight,
    gap,
    blockHeight: dateHeight + gap + pairHeight,
  };
}

function drawScaledLine(doc, text, x, y, lineWidth, font, size) {
  doc.font(font).fontSize(size).fillColor('black');
  const textWidth = Math.max(0.01, doc.widthOfString(text));
  const scale = Math.min(1, lineWidth / textWidth);
  const scaledLineWidth = lineWidth / scale;
  const centeredX = Math.max(0, (scaledLineWidth - textWidth) / 2);
  doc.save();
  doc.translate(x, y);
  doc.scale(scale, 1);
  doc.text(text, centeredX, 0, {
    width: textWidth,
    lineBreak: false,
  });
  doc.restore();
}

function matchCellFontSize(matchWidth) {
  if (matchWidth < 12) return 4.8;
  if (matchWidth < 16) return 5.5;
  if (matchWidth < 22) return 6.4;
  return 7.2;
}

function drawCentered(doc, text, y, width, font, size, options = {}) {
  doc
    .font(font)
    .fontSize(size)
    .fillColor('black')
    .text(text, PAGE_MARGIN, y, {
      width,
      align: 'center',
      lineGap: options.lineGap ?? 0,
    });
}

function drawDocumentLogos(doc) {
  if (PDF_LOGOS.federation) {
    try {
      doc.image(PDF_LOGOS.federation, PAGE_MARGIN, LOGO_TOP, {
        height: FEDERATION_LOGO_HEIGHT,
      });
    } catch {
      /* ignore logo rendering failure */
    }
  }
  if (PDF_LOGOS.system) {
    try {
      doc.image(
        PDF_LOGOS.system,
        doc.page.width - PAGE_MARGIN - SYSTEM_LOGO_WIDTH,
        LOGO_TOP,
        {
          width: SYSTEM_LOGO_WIDTH,
        }
      );
    } catch {
      /* ignore logo rendering failure */
    }
  }
}

function textHeight(doc, text, width, font, size, options = {}) {
  doc.font(font).fontSize(size);
  return doc.heightOfString(String(text ?? ''), {
    width,
    align: options.align || 'center',
    lineGap: options.lineGap ?? 0,
  });
}

function truncateToHeight(doc, text, width, font, size, maxHeight) {
  const normalized = normalizeText(text);
  if (textHeight(doc, normalized, width, font, size) <= maxHeight) {
    return normalized;
  }
  let left = 0;
  let right = normalized.length;
  let best = '';
  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const candidate = truncateText(normalized, middle);
    if (textHeight(doc, candidate, width, font, size) <= maxHeight) {
      best = candidate;
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }
  return best || truncateText(normalized, 24);
}

function documentHeaderLayout(doc, fonts, summary, meta) {
  const width = doc.page.width - PAGE_MARGIN * 2;
  const eventDates = `${formatDate(meta.event_date_start)} - ${formatDate(
    meta.event_date_end
  )}`;
  const registryLine = `Реестровый номер мероприятия ${meta.registry_number}   Сроки проведения ${eventDates}`;
  const eventLine = `Наименование мероприятия ${meta.event_name}`;
  const titleSize = 11.2;
  const metaSize = 8.6;
  const teamSize = 9.8;
  const eventMaxHeight = 22;
  const safeEventLine = truncateToHeight(
    doc,
    eventLine,
    width,
    fonts.bold,
    metaSize,
    eventMaxHeight
  );
  const titleHeight = textHeight(
    doc,
    'Выписка из протокола',
    width,
    fonts.bold,
    titleSize
  );
  const registryHeight = textHeight(
    doc,
    registryLine,
    width,
    fonts.bold,
    metaSize
  );
  const eventHeight = textHeight(
    doc,
    safeEventLine,
    width,
    fonts.bold,
    metaSize
  );
  const teamHeight = textHeight(
    doc,
    `Название команды «${summary.team_name || ''}»`,
    width,
    fonts.bold,
    teamSize
  );
  const playedHeight = textHeight(
    doc,
    `Сыграно матчей: ${summary.matches.length}`,
    width,
    fonts.bold,
    teamSize
  );
  return {
    width,
    titleSize,
    metaSize,
    teamSize,
    registryLine,
    eventLine: safeEventLine,
    titleHeight,
    registryHeight,
    eventHeight,
    teamHeight,
    playedHeight,
    height:
      TITLE_TOP -
      PAGE_MARGIN +
      titleHeight +
      registryHeight +
      eventHeight +
      teamHeight +
      playedHeight +
      21 +
      MIN_TABLE_GAP,
  };
}

function drawDocumentHeader(doc, fonts, summary, meta, layout) {
  drawDocumentLogos(doc);
  const y0 = TITLE_TOP;
  let y = y0;
  drawCentered(
    doc,
    'Выписка из протокола',
    y,
    layout.width,
    fonts.bold,
    layout.titleSize
  );
  y += layout.titleHeight + 7;
  drawCentered(
    doc,
    layout.registryLine,
    y,
    layout.width,
    fonts.bold,
    layout.metaSize
  );
  y += layout.registryHeight + 2;
  drawCentered(
    doc,
    layout.eventLine,
    y,
    layout.width,
    fonts.bold,
    layout.metaSize
  );
  y += layout.eventHeight + 7;
  drawCentered(
    doc,
    `Название команды «${summary.team_name || ''}»`,
    y,
    layout.width,
    fonts.bold,
    layout.teamSize
  );
  y += layout.teamHeight + 5;
  drawCentered(
    doc,
    `Сыграно матчей: ${summary.matches.length}`,
    y,
    layout.width,
    fonts.bold,
    layout.teamSize
  );
}

function drawCell(doc, x, y, width, height, text, options = {}) {
  const {
    font,
    size = 9,
    align = 'center',
    valign = 'center',
    border = true,
    fill = null,
  } = options;
  if (fill) {
    doc.rect(x, y, width, height).fillColor(fill).fill();
  }
  if (border) {
    doc.rect(x, y, width, height).strokeColor('black').lineWidth(0.5).stroke();
  }
  const textHeight = doc.heightOfString(String(text ?? ''), {
    width: width - 4,
    align,
  });
  const textY =
    valign === 'center' ? y + Math.max(2, (height - textHeight) / 2) : y + 3;
  doc
    .font(font)
    .fontSize(size)
    .fillColor('black')
    .text(String(text ?? ''), x + 2, textY, {
      width: width - 4,
      align,
      lineBreak: true,
    });
}

function drawRotatedHeader(doc, x, y, width, height, parts, font) {
  const textWidth = height - ROTATED_HEADER_PADDING * 2;
  const availableBlockHeight = width - ROTATED_HEADER_PADDING * 2;
  const layout = rotatedHeaderLayout(
    doc,
    parts,
    font,
    textWidth,
    availableBlockHeight
  );
  doc.rect(x, y, width, height).strokeColor('black').lineWidth(0.5).stroke();

  doc.save();
  doc.translate(x, y + height);
  doc.rotate(-90);
  doc.rect(0, 0, height, width).clip();

  const textX = ROTATED_HEADER_PADDING;
  const textY =
    ROTATED_HEADER_PADDING +
    Math.max(0, (availableBlockHeight - layout.blockHeight) / 2);
  drawScaledLine(
    doc,
    parts.date,
    textX,
    textY,
    textWidth,
    font,
    layout.dateSize
  );
  drawScaledLine(
    doc,
    parts.pair,
    textX,
    textY + layout.dateHeight + layout.gap,
    textWidth,
    font,
    layout.pairSize
  );
  doc.restore();
}

function drawTableHeader(doc, fonts, y, matches, layout) {
  const x0 = PAGE_MARGIN;
  const topGroupHeight = 13;
  const verticalHeaderHeight = TABLE_HEADER_HEIGHT - topGroupHeight;
  let x = x0;

  drawCell(doc, x, y, NUMBER_WIDTH, TABLE_HEADER_HEIGHT, '№', {
    font: fonts.bold,
    size: 7.2,
  });
  x += NUMBER_WIDTH;
  drawCell(doc, x, y, NAME_WIDTH, TABLE_HEADER_HEIGHT, 'Ф.И.О.\nспортсмена', {
    font: fonts.bold,
    size: 7.4,
  });
  x += NAME_WIDTH;
  drawCell(doc, x, y, BIRTH_WIDTH, TABLE_HEADER_HEIGHT, 'Дата\nрождения', {
    font: fonts.bold,
    size: 7.2,
  });
  x += BIRTH_WIDTH;

  if (matches.length) {
    drawCell(
      doc,
      x,
      y,
      layout.matchGroupWidth,
      topGroupHeight,
      'Количество проведённых матчей хоккеистами',
      { font: fonts.bold, size: 6.6 }
    );
  }
  for (const match of matches) {
    const headerParts = matchHeaderParts(match);
    drawRotatedHeader(
      doc,
      x,
      y + topGroupHeight,
      layout.matchWidth,
      verticalHeaderHeight,
      headerParts,
      fonts.regular
    );
    x += layout.matchWidth;
  }

  drawCell(doc, x, y, PERCENT_WIDTH, TABLE_HEADER_HEIGHT, 'Итого\n(в %)', {
    font: fonts.bold,
    size: 7,
    fill: 'white',
  });
}

function drawPlayerRow(doc, fonts, y, player, index, matches, layout) {
  let x = PAGE_MARGIN;
  drawCell(doc, x, y, NUMBER_WIDTH, ROW_HEIGHT, index, {
    font: fonts.regular,
    size: 6.4,
  });
  x += NUMBER_WIDTH;
  drawCell(doc, x, y, NAME_WIDTH, ROW_HEIGHT, player.full_name || '—', {
    font: fonts.bold,
    size: 6.5,
    align: 'left',
  });
  x += NAME_WIDTH;
  drawCell(
    doc,
    x,
    y,
    BIRTH_WIDTH,
    ROW_HEIGHT,
    formatDate(player.date_of_birth),
    {
      font: fonts.bold,
      size: 6.4,
    }
  );
  x += BIRTH_WIDTH;
  for (const match of matches) {
    drawCell(
      doc,
      x,
      y,
      layout.matchWidth,
      ROW_HEIGHT,
      player.cells?.[match.id] || 0,
      {
        font: fonts.regular,
        size: matchCellFontSize(layout.matchWidth),
      }
    );
    x += layout.matchWidth;
  }
  drawCell(
    doc,
    x,
    y,
    PERCENT_WIDTH,
    ROW_HEIGHT,
    formatPercent(percentFor(player, matches)),
    {
      font: fonts.regular,
      size: 6.3,
    }
  );
}

async function buildTransparentSealImage() {
  try {
    const { data, info } = await sharp(SEAL_PATH)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (red > 242 && green > 242 && blue > 242) {
        data[index + 3] = 0;
      } else if (red > 232 && green > 232 && blue > 232) {
        const distanceFromWhite = 255 - Math.min(red, green, blue);
        data[index + 3] = Math.min(
          data[index + 3],
          Math.max(0, Math.round(distanceFromWhite * 10))
        );
      }
    }
    return await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .png()
      .toBuffer();
  } catch (err) {
    const error = new ServiceError('participation_summary_seal_missing', 422);
    error.cause = err;
    throw error;
  }
}

async function buildSignatureImage() {
  try {
    return await sharp(SIGNATURE_IMAGE_PATH)
      .ensureAlpha()
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch (err) {
    const error = new ServiceError(
      'participation_summary_signature_missing',
      422
    );
    error.cause = err;
    throw error;
  }
}

function signatureTop(doc, tableBottom) {
  const preferredTop = doc.page.height - PAGE_MARGIN - SIGNATURE_BLOCK_HEIGHT;
  return Math.max(preferredTop, tableBottom + SIGNATURE_GAP);
}

function drawSignature(doc, fonts, sealImage, signatureImage, tableBottom) {
  const top = signatureTop(doc, tableBottom);
  const sealX = doc.page.width - PAGE_MARGIN - 300;
  const sealY = top - 55;
  const signatureX = sealX - 18;
  const signatureY = top - 42;

  doc
    .font(fonts.bold)
    .fontSize(8.8)
    .fillColor('black')
    .text(
      'Ведущий специалист по проведению соревнований\nРОО «Федерация хоккея Москвы»',
      PAGE_MARGIN + 35,
      top,
      {
        width: 360,
        align: 'left',
        lineGap: 2,
      }
    );
  doc
    .font(fonts.bold)
    .fontSize(9.5)
    .text('М. П. Усанов', doc.page.width - PAGE_MARGIN - 145, top + 7, {
      width: 125,
      align: 'right',
    });

  try {
    doc.image(signatureImage, signatureX, signatureY, {
      fit: [265, 120],
      align: 'center',
      valign: 'center',
    });
    doc.image(sealImage, sealX, sealY, {
      fit: [135, 135],
      align: 'center',
      valign: 'center',
    });
  } catch (err) {
    const error = new ServiceError('participation_summary_seal_missing', 422);
    error.cause = err;
    throw error;
  }
}

export default async function buildTeamParticipationSummarySignedPdf({
  summary,
  players,
  meta,
}) {
  try {
    fs.accessSync(SEAL_PATH, fs.constants.R_OK);
  } catch {
    throw new ServiceError('participation_summary_seal_missing', 422);
  }
  const sealImage = await buildTransparentSealImage();
  const signatureImage = await buildSignatureImage();

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: { Title: 'Выписка из протокола' },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const fonts = applyFonts(doc);

  const headerLayout = documentHeaderLayout(doc, fonts, summary, meta);
  const layout = tableLayout(doc, summary.matches);
  const rowChunks = splitIntoChunks(
    players,
    maxRowsPerPage(doc, headerLayout.height)
  );
  const pages = [];
  let rowOffset = 0;
  for (const rowChunk of rowChunks) {
    pages.push({ rowChunk, rowOffset });
    rowOffset += rowChunk.length;
  }

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) doc.addPage();
    drawDocumentHeader(doc, fonts, summary, meta, headerLayout);
    const tableY = PAGE_MARGIN + headerLayout.height;
    drawTableHeader(doc, fonts, tableY, summary.matches, layout);
    page.rowChunk.forEach((player, rowIndex) => {
      drawPlayerRow(
        doc,
        fonts,
        tableY + TABLE_HEADER_HEIGHT + ROW_HEIGHT * rowIndex,
        player,
        page.rowOffset + rowIndex + 1,
        summary.matches,
        layout
      );
    });
    const tableBottom =
      tableY + TABLE_HEADER_HEIGHT + ROW_HEIGHT * page.rowChunk.length;
    if (pageIndex === pages.length - 1) {
      drawSignature(doc, fonts, sealImage, signatureImage, tableBottom);
    }
  });

  doc.end();
  return done;
}
