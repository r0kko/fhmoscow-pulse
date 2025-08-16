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
    /* noop */
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
