import PDFDocument from 'pdfkit';

import {
  applyFonts,
  applyFirstPageHeader,
  applyFooter,
  applyESignStamp,
} from '../../utils/pdf.js';

function normalizeText(value, fallback = '—') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeMultilineText(value, fallback = '—') {
  const lines = String(value || '')
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return fallback;
  return lines.join('\n');
}

function normalizeRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      role: normalizeMultilineText(row?.role),
      referee: normalizeMultilineText(row?.referee),
      vehicles: normalizeMultilineText(row?.vehicles),
    }))
    .filter(
      (row) => row.role !== '—' || row.referee !== '—' || row.vehicles !== '—'
    )
    .sort((left, right) =>
      left.referee.localeCompare(right.referee, 'ru', {
        sensitivity: 'base',
      })
    );
}

function drawVerticalSplitters(doc, x, y, widths, height) {
  let cursor = x;
  widths.slice(0, -1).forEach((width) => {
    cursor += width;
    doc.moveTo(cursor, y).lineTo(cursor, y + height).stroke();
  });
}

function drawHeaderBand(doc, fonts, table, labels) {
  const cellPaddingX = 6;
  const cellPaddingY = 5;
  const aligns = ['center', 'center', 'center', 'center'];
  const headerTextOptions = labels.map((_, index) => ({
    width: table.widths[index] - cellPaddingX * 2,
    align: aligns[index] || 'left',
  }));
  doc.font(fonts.bold).fontSize(9.5);
  const rowTop = doc.y;
  const headerHeight = Math.max(
    24,
    ...labels.map((label, index) =>
      Math.ceil(
        doc.heightOfString(label, headerTextOptions[index])
      ) +
        cellPaddingY * 2
    )
  );

  doc
    .save()
    .lineWidth(0.8)
    .fillColor('#f3f5f7')
    .strokeColor('#a8b3c2')
    .rect(table.x, rowTop, table.width, headerHeight)
    .fillAndStroke()
    .restore();

  doc.save().lineWidth(0.8).strokeColor('#a8b3c2');
  drawVerticalSplitters(doc, table.x, rowTop, table.widths, headerHeight);
  doc.restore();

  let colX = table.x;
  labels.forEach((label, index) => {
    const options = headerTextOptions[index];
    const textHeight = Math.ceil(doc.heightOfString(label, options));
    const textY = rowTop + Math.max(cellPaddingY, (headerHeight - textHeight) / 2);
    doc
      .font(fonts.bold)
      .fontSize(9.5)
      .fillColor('#111827')
      .text(label, colX + cellPaddingX, textY, options);
    colX += table.widths[index];
  });

  doc.y = rowTop + headerHeight;
}

function drawDataRow(doc, fonts, table, row) {
  const cellPaddingX = 6;
  const cellPaddingY = 5;
  const aligns = ['center', 'left', 'center', 'center'];
  doc.font(fonts.regular).fontSize(10);
  const rowTop = doc.y;

  const values = [String(row.index || ''), row.referee, row.role, row.vehicles];
  const textOptions = values.map((_, index) => ({
    width: table.widths[index] - cellPaddingX * 2,
    align: aligns[index] || 'left',
  }));
  const rowHeight = Math.max(
    22,
    ...values.map((value, index) =>
      Math.ceil(
        doc.heightOfString(value, textOptions[index])
      ) +
        cellPaddingY * 2
    )
  );

  doc
    .save()
    .lineWidth(0.6)
    .fillColor('#ffffff')
    .strokeColor('#cbd5e1')
    .rect(table.x, rowTop, table.width, rowHeight)
    .fillAndStroke()
    .restore();

  doc.save().lineWidth(0.6).strokeColor('#cbd5e1');
  drawVerticalSplitters(doc, table.x, rowTop, table.widths, rowHeight);
  doc.restore();

  let colX = table.x;
  values.forEach((value, index) => {
    const options = textOptions[index];
    const textHeight = Math.ceil(doc.heightOfString(value, options));
    const textY = rowTop + Math.max(cellPaddingY, (rowHeight - textHeight) / 2);
    const textX = colX + cellPaddingX;
    const textWidth = table.widths[index] - cellPaddingX * 2;
    const align = aligns[index] || 'left';
    const isMultilineCenter = align === 'center' && String(value).includes('\n');
    doc
      .font(fonts.regular)
      .fontSize(10)
      .fillColor('#111827');
    if (isMultilineCenter) {
      const lines = String(value)
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean);
      const lineHeight = Math.ceil(doc.currentLineHeight(true));
      const blockHeight = lineHeight * (lines.length || 1);
      let lineY =
        rowTop + Math.max(cellPaddingY, Math.floor((rowHeight - blockHeight) / 2));
      (lines.length ? lines : [String(value)]).forEach((line) => {
        const lineWidth = Math.ceil(doc.widthOfString(line));
        const lineX = Math.max(
          textX,
          colX + Math.floor((table.widths[index] - lineWidth) / 2)
        );
        doc.text(line, lineX, lineY, { lineBreak: false });
        lineY += lineHeight;
      });
    } else {
      doc.text(value, textX, textY, {
        width: textWidth,
        align,
      });
    }
    colX += table.widths[index];
  });

  doc.y = rowTop + rowHeight;
}

function ensurePageForTable(doc, minimumBottom, renderTableHeader) {
  if (doc.y <= minimumBottom) return;
  doc.addPage();
  applyFirstPageHeader(doc);
  doc.y = Math.max(doc.y, 86);
  renderTableHeader();
}

export default async function buildProLeagueRefereeAssignmentsSheetPdf(
  payload = {},
  meta = {}
) {
  const dividerGapBefore = 0.35;
  const dividerGapAfter = 0.55;
  const tableGapAfterMatchDivider = 0.78;
  const rows = normalizeRows(payload?.rows);
  const chunks = [];
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 30, bottom: 80, left: 30, right: 30 },
    bufferPages: true,
    info: {
      Title: normalizeText(payload?.title, 'Назначения судей на матч'),
    },
  });
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on('end', () => resolve()));

  const fonts = applyFonts(doc);
  applyFirstPageHeader(doc);

  doc.y = Math.max(doc.y, 86);
  doc
    .font(fonts.bold)
    .fontSize(15)
    .fillColor('#0f172a')
    .text(normalizeText(payload?.title, 'Назначения судей на матч'), {
      align: 'center',
    });

  doc
    .moveDown(dividerGapBefore)
    .save()
    .lineWidth(0.8)
    .strokeColor('#d1d5db')
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke()
    .restore();

  doc
    .moveDown(dividerGapAfter)
    .font(fonts.bold)
    .fontSize(13)
    .fillColor('#0f172a')
    .text(normalizeText(payload?.teams), {
      align: 'center',
    });

  doc
    .moveDown(0.22)
    .font(fonts.regular)
    .fontSize(11)
    .fillColor('#475569')
    .text(normalizeText(payload?.leagueName), {
      align: 'center',
    });

  doc
    .moveDown(0.16)
    .font(fonts.regular)
    .fontSize(10)
    .fillColor('#64748b')
    .text(normalizeText(payload?.arenaAddress, 'Адрес арены не указан'), {
      align: 'center',
    });

  doc
    .moveDown(0.18)
    .font(fonts.regular)
    .fontSize(11)
    .fillColor('#374151')
    .text(normalizeText(payload?.dateTime), {
      align: 'center',
    });

  doc
    .moveDown(dividerGapBefore)
    .save()
    .lineWidth(0.8)
    .strokeColor('#d1d5db')
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke()
    .restore();

  doc.moveDown(tableGapAfterMatchDivider);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const contentWidth = right - left;

  const table = {
    x: left,
    width: contentWidth,
    widths: [
      Math.floor(contentWidth * 0.08),
      Math.floor(contentWidth * 0.4),
      Math.floor(contentWidth * 0.28),
      contentWidth -
        Math.floor(contentWidth * 0.08) -
        Math.floor(contentWidth * 0.4) -
        Math.floor(contentWidth * 0.28),
    ],
  };

  const headerLabels = ['№', 'ФИО', 'Амплуа', 'Автомобиль'];
  const renderTableHeader = () => drawHeaderBand(doc, fonts, table, headerLabels);
  renderTableHeader();

  const minBottomY = doc.page.height - doc.page.margins.bottom - 40;
  const dataRows = rows.length
    ? rows.map((row, index) => ({
        index: index + 1,
        ...row,
      }))
    : [{ index: 1, role: '—', referee: 'Назначения не указаны', vehicles: '—' }];

  dataRows.forEach((row) => {
    ensurePageForTable(doc, minBottomY, renderTableHeader);
    drawDataRow(doc, fonts, table, row);
  });

  const pageRange = doc.bufferedPageRange();
  for (let page = 0; page < pageRange.count; page += 1) {
    doc.switchToPage(pageRange.start + page);
    await applyFooter(doc, {
      page: page + 1,
      total: pageRange.count,
      barcodeText: meta?.docId || null,
      numberText: meta?.number || null,
    });
    if (meta?.esign && page === pageRange.count - 1) {
      await applyESignStamp(doc, {
        docId: meta.docId,
        signId: meta.esign.signId,
        userId: meta.esign.signer?.id || null,
        signerPosition: meta.esign.signer?.position || null,
        signerDepartment: meta.esign.signer?.department || null,
        signerOrganization: meta.esign.signer?.organization || null,
        fio: [
          meta.esign.signer?.last_name,
          meta.esign.signer?.first_name,
          meta.esign.signer?.patronymic,
        ]
          .filter(Boolean)
          .join(' '),
        signedAt: meta.esign.signedAt,
        page: page + 1,
        total: pageRange.count,
      });
    }
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}
