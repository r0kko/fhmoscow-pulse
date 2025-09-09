/* istanbul ignore file */
import fs from 'fs';

import { PDF_FONTS, PDF_LOGOS, PDF_META } from '../config/pdf.js';

import { renderPdf417 } from './barcode.js';

const FALLBACK_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const FALLBACK_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

export function applyFonts(doc) {
  let regular = 'Helvetica';
  let bold = 'Helvetica-Bold';

  if (PDF_FONTS.regular) {
    try {
      fs.accessSync(PDF_FONTS.regular, fs.constants.R_OK);
      doc.registerFont('SB-Regular', PDF_FONTS.regular);
      regular = 'SB-Regular';
    } catch {
      /* empty */
    }
  }

  if (PDF_FONTS.bold) {
    try {
      fs.accessSync(PDF_FONTS.bold, fs.constants.R_OK);
      doc.registerFont('SB-Bold', PDF_FONTS.bold);
      bold = 'SB-Bold';
    } catch {
      /* empty */
    }
  }

  // Fallback fonts for Cyrillic support
  if (regular === 'Helvetica') {
    try {
      doc.registerFont('Default-Regular', FALLBACK_REGULAR);
      regular = 'Default-Regular';
    } catch {
      /* empty */
    }
  }

  if (bold === 'Helvetica-Bold') {
    try {
      doc.registerFont('Default-Bold', FALLBACK_BOLD);
      bold = 'Default-Bold';
    } catch {
      /* empty */
    }
  }

  if (PDF_FONTS.italic) {
    try {
      fs.accessSync(PDF_FONTS.italic, fs.constants.R_OK);
      doc.registerFont('SB-Italic', PDF_FONTS.italic);
    } catch {
      /* empty */
    }
  }

  if (PDF_FONTS.boldItalic) {
    try {
      fs.accessSync(PDF_FONTS.boldItalic, fs.constants.R_OK);
      doc.registerFont('SB-BoldItalic', PDF_FONTS.boldItalic);
    } catch {
      /* empty */
    }
  }

  return { regular, bold };
}

export function applyFirstPageHeader(doc) {
  const margin = 30;
  const logoHeight = 32; // slightly larger federation mark
  const systemWidth = 80; // slightly smaller system logo
  const top = margin;
  const { federation, system } = PDF_LOGOS;

  if (federation) {
    try {
      doc.image(federation, margin, top, { height: logoHeight });
    } catch {
      /* image failed to load */
    }
  }

  if (system) {
    try {
      doc.image(system, doc.page.width - margin - systemWidth, top, {
        width: systemWidth,
      });
    } catch {
      /* image failed to load */
    }
  }

  doc.fillColor('black').fontSize(10);
}

function formatRuDateTime(d) {
  try {
    const s = new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
      hour12: false,
    }).format(d);
    return `${s}`;
  } catch {
    const pad = (n) => String(n).padStart(2, '0');
    const dd = pad(d.getUTCDate());
    const mm = pad(d.getUTCMonth() + 1);
    const yyyy = d.getUTCFullYear();
    const hh = pad(d.getUTCHours() + 3);
    const mi = pad(d.getUTCMinutes());
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
  }
}

export async function applyFooter(
  doc,
  { page, total, barcodeText, numberText }
) {
  const outerLeft = 30;
  const outerRight = 30;
  const outerBottom = 20;
  const bandHeight = 44; // fixed footer band height
  const bandTop = Math.max(0, doc.page.height - outerBottom - bandHeight);
  const lineY = bandTop; // divider at top of band
  const textY = bandTop + 8;
  const size = 9;
  const pageLabel = `Страница № ${page} из ${total}`;
  // separator line above footer
  try {
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor('#cccccc')
      .moveTo(outerLeft, lineY)
      .lineTo(doc.page.width - outerRight, lineY)
      .stroke()
      .restore();
  } catch {
    // ignore drawing failure
  }
  // left: document number · page X of Y, plus optional system/timestamp
  try {
    const prevX = doc.x;
    const prevY = doc.y;
    doc.save();
    doc.fontSize(size).fillColor('#666666');
    const leftLine = numberText
      ? `${String(numberText)} · ${pageLabel}`
      : pageLabel;
    doc.text(leftLine, outerLeft, textY, { lineBreak: false });
    const metaBits = [];
    if (PDF_META?.systemLabel) metaBits.push(PDF_META.systemLabel);
    metaBits.push(formatRuDateTime(new Date()));
    const meta = metaBits.join(' · ');
    doc.fontSize(size - 1).fillColor('#888888');
    doc.text(meta, outerLeft, textY + 12, { lineBreak: false });
    doc.restore();
    // restore flow cursor so footer doesn't affect content engine
    doc.x = prevX;
    doc.y = prevY;
  } catch {
    /* noop */
  }
  // right: barcode only (UUID)
  const usableWidth = doc.page.width - outerLeft - outerRight;
  const rightBoxWidth = usableWidth / 2;
  // barcode below the number; ensure fits in band
  // Align barcode top with the main line (optical alignment)
  const barcodeY = textY;
  let drew = false;
  if (barcodeText) {
    try {
      const desiredWidth = PDF_META?.barcodeWidth || 110;
      const maxBarcodeWidth = Math.min(rightBoxWidth, desiredWidth);
      const bx = doc.page.width - outerRight - maxBarcodeWidth;
      // draw lighter (gray-ish) by lowering opacity
      doc.save();
      doc.opacity(PDF_META?.barcodeOpacity ?? 0.7);
      drew = await renderPdf417(
        doc,
        bx,
        barcodeY,
        maxBarcodeWidth,
        Math.max(8, bandHeight - 24),
        barcodeText
      );
      doc.opacity(1);
      doc.restore();
    } catch {
      drew = false;
    }
  }
  if (!drew && barcodeText) {
    // fallback: render UUID as gray text under the number
    try {
      const prevX = doc.x;
      const prevY = doc.y;
      doc.save();
      doc.fontSize(size).fillColor('#999999');
      const ustr = String(barcodeText);
      const uwidth = doc.widthOfString(ustr);
      const ux = doc.page.width - outerRight - uwidth;
      doc.text(ustr, ux, barcodeY, { lineBreak: false });
      doc.restore();
      doc.x = prevX;
      doc.y = prevY;
    } catch {
      /* noop */
    }
  }
  doc.fillColor('black');
}

export async function applyESignStamp(doc, info) {
  // Draw a compact signature stamp anchored to the right, above the footer band
  const BRAND_BLUE = '#113867';
  const margin = 30;
  const bandHeight = 44; // must match footer band
  const stampHeight = 68;
  const stampWidth = 280;
  const x = doc.page.width - margin - stampWidth;
  const y = doc.page.height - margin - bandHeight - stampHeight - 6;
  try {
    doc
      .save()
      .lineWidth(0.9)
      .roundedRect(x, y, stampWidth, stampHeight, 6)
      .stroke(BRAND_BLUE)
      .restore();
  } catch {
    /* noop */
  }
  // QR area (higher pixel density for print)
  const qrSize = 64;
  const qrX = x + 8;
  const qrY = y + 6;
  const textX = qrX + qrSize + 10;
  const line1Y = y + 8;
  const line2Y = line1Y + 16;
  const line3Y = line2Y + 16;
  const line4Y = line3Y + 16;
  const payload = `USER:${String(info.userId || '')}`;
  let QR;
  try {
    QR = await import('qrcode');
  } catch {
    QR = null;
  }
  if (QR?.toDataURL) {
    try {
      const dataUrl = await QR.toDataURL(payload, {
        errorCorrectionLevel: 'H',
        margin: 0,
        width: qrSize * 2,
        color: { dark: BRAND_BLUE, light: '#ffffff' },
      });
      doc.image(dataUrl, qrX, qrY, {
        width: qrSize,
        height: qrSize,
        fit: [qrSize, qrSize],
      });
    } catch {
      doc.rect(qrX, qrY, qrSize, qrSize).stroke(BRAND_BLUE);
    }
  } else {
    try {
      doc.rect(qrX, qrY, qrSize, qrSize).stroke(BRAND_BLUE);
    } catch {
      /* noop */
    }
  }
  // Text content — brand blue
  const title = 'ДОКУМЕНТ ПОДПИСАН ЭП';
  const fio = String(info.fio || '');
  // Format date: DD.MM.YYYY в HH:mm (Europe/Moscow)
  let dtText = '';
  try {
    const d = new Date(info.signedAt || Date.now());
    const pad = (n) => String(n).padStart(2, '0');
    const tz = 'Europe/Moscow';
    const dd = pad(
      new Intl.DateTimeFormat('ru-RU', { day: '2-digit', timeZone: tz }).format(
        d
      )
    );
    const mm = pad(
      new Intl.DateTimeFormat('ru-RU', {
        month: '2-digit',
        timeZone: tz,
      }).format(d)
    );
    const yyyy = new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      timeZone: tz,
    }).format(d);
    const hh = pad(
      new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        hour12: false,
        timeZone: tz,
      }).format(d)
    );
    const mi = pad(
      new Intl.DateTimeFormat('ru-RU', {
        minute: '2-digit',
        timeZone: tz,
      }).format(d)
    );
    dtText = `${dd}.${mm}.${yyyy} в ${hh}:${mi}`;
  } catch {
    /* noop */
  }
  const pageInfo = `Страница № ${info.page || 1} из ${info.total || 1}`;
  try {
    doc.fontSize(9).fillColor(BRAND_BLUE);
    doc.text(title, textX, line1Y, { lineBreak: false });
    doc.text(fio, textX, line2Y, { lineBreak: false });
    doc.text(`Дата подписания: ${dtText}`, textX, line3Y, { lineBreak: false });
    doc.text(pageInfo, textX, line4Y, { lineBreak: false });
  } catch {
    /* noop */
  }
  doc.fillColor('black');
}
