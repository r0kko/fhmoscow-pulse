import fs from 'fs';

import { PDF_FONTS, PDF_LOGOS } from '../config/pdf.js';

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

export function applyFirstPageFooter(doc) {
  const margin = 30;
  const logoHeight = 40;
  const bottom = doc.page.height - margin - logoHeight;
  const { federation, system } = PDF_LOGOS;

  if (federation) {
    try {
      doc.image(federation, margin, bottom, { height: logoHeight });
    } catch {
      /* empty */
    }
  }

  doc
    .fillColor('#0E3869')
    .fontSize(10)
    .text('Федерация хоккея Москвы', margin, bottom, {
      align: 'center',
      width: doc.page.width - margin * 2,
    });

  if (system) {
    try {
      doc.image(system, doc.page.width - margin - logoHeight, bottom, {
        height: logoHeight,
      });
    } catch {
      /* empty */
    }
  }
}
