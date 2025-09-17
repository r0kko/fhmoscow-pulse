/* istanbul ignore file */
import fs from 'fs';

import { PDF_FONTS, PDF_LOGOS, PDF_META } from '../config/pdf.js';

import { renderPdf417 } from './barcode.js';
import { buildVerifyUrl } from './verifyDocHmac.js';

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
    /* ignore border drawing failure */
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
  // Stamp sizing (configurable)
  const stampHeight = Math.max(56, PDF_META?.stampHeight || 66);
  const stampWidthMax = Math.max(220, PDF_META?.stampWidth || 270);
  const stampWidthMin = Math.max(160, PDF_META?.stampWidthMin || 220);
  const padX = Math.max(6, PDF_META?.stampPadX || 10);
  const padY = Math.max(4, PDF_META?.stampPadY || 8);
  const qrGap = Math.max(6, PDF_META?.stampGap || 10);
  // Overlay above the footer band without altering content margins
  const y = doc.page.height - margin - bandHeight - stampHeight - 6;
  // Inner content box initial (excludes outer padding). Width may shrink.
  let stampWidth = stampWidthMax;
  let innerWidth = stampWidth - 2 * padX;
  const innerHeight = stampHeight - 2 * padY;
  // Prepare texts to measure available width for QR
  const title = 'ДОКУМЕНТ ПОДПИСАН ЭП';
  const fio = String(info.fio || '');
  let dtText = '';
  try {
    const d = new Date(info.signedAt || Date.now());
    const pad2 = (n) => String(n).padStart(2, '0');
    const tz = 'Europe/Moscow';
    const dd = pad2(
      new Intl.DateTimeFormat('ru-RU', { day: '2-digit', timeZone: tz }).format(
        d
      )
    );
    const mm = pad2(
      new Intl.DateTimeFormat('ru-RU', {
        month: '2-digit',
        timeZone: tz,
      }).format(d)
    );
    const yyyy = new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      timeZone: tz,
    }).format(d);
    const hh = pad2(
      new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        hour12: false,
        timeZone: tz,
      }).format(d)
    );
    const mi = pad2(
      new Intl.DateTimeFormat('ru-RU', {
        minute: '2-digit',
        timeZone: tz,
      }).format(d)
    );
    dtText = `${dd}.${mm}.${yyyy} в ${hh}:${mi}`;
  } catch {
    /* ignore date format errors */
  }
  const pageInfo = `Страница № ${info.page || 1} из ${info.total || 1}`;
  // Measure max text width at 8pt, bold for title
  const prevFont = doc._font?.name || null;
  const prevSize = doc._fontSize || null;
  // Precompute fallback positions to ensure defined values
  let qrSize = Math.max(28, PDF_META?.qrMinSize || 40);
  let qrX = 0;
  let qrY = y + padY;
  let textX = 0;
  try {
    doc.fontSize(8);
    try {
      doc.font('SB-Bold');
    } catch {
      try {
        doc.font('Default-Bold');
      } catch {
        doc.font('Helvetica-Bold');
      }
    }
    const w1 = doc.widthOfString(title);
    try {
      doc.font('SB-Regular');
    } catch {
      try {
        doc.font('Default-Regular');
      } catch {
        doc.font('Helvetica');
      }
    }
    const w2 = doc.widthOfString(fio || '');
    const w3 = doc.widthOfString(`Дата подписания: ${dtText}`);
    const w4 = doc.widthOfString(pageInfo);
    const maxTextWidth = Math.max(w1, w2, w3, w4);
    // Compute QR size bounds by height and remaining width in the inner box
    const qrMaxByHeight = Math.max(24, innerHeight);
    const qrMaxByWidth = Math.max(16, innerWidth - qrGap - maxTextWidth);
    const qrMin = Math.max(28, PDF_META?.qrMinSize || 40);
    // Target an aesthetically balanced ratio of the inner box
    const rawRatio = Number.isFinite(PDF_META?.qrIdealRatio)
      ? PDF_META.qrIdealRatio
      : 0.46;
    const ratio = Math.min(0.6, Math.max(0.25, rawRatio));
    const idealByInner = Math.floor(Math.min(innerWidth, innerHeight) * ratio);
    // Choose the largest size that fits bounds while respecting the ideal target
    qrSize = Math.max(
      qrMin,
      Math.min(qrMaxByHeight, qrMaxByWidth, idealByInner)
    );
    // Shift down if over-constrained: allow small reduction of title size
    if (qrSize < qrMin) {
      // Try with 7.5pt
      try {
        doc.fontSize(7.5);
      } catch {
        /* ignore font sizing */
      }
      const w1s = doc.widthOfString(title);
      const w2s = doc.widthOfString(fio || '');
      const w3s = doc.widthOfString(`Дата подписания: ${dtText}`);
      const w4s = doc.widthOfString(pageInfo);
      const maxS = Math.max(w1s, w2s, w3s, w4s);
      const widthBudget2 = Math.max(16, innerWidth - qrGap - maxS);
      const idealByInner2 = Math.floor(
        Math.min(innerWidth, innerHeight) * ratio
      );
      qrSize = Math.max(
        qrMin,
        Math.min(qrMaxByHeight, widthBudget2, idealByInner2)
      );
      // Restore size to 8 for drawing; spacing will adapt
      try {
        doc.fontSize(8);
      } catch {
        /* ignore font sizing */
      }
    }
    // After we know text widths and QR, try to shrink stamp width harmoniously
    const requiredInner = Math.max(qrSize + qrGap + maxTextWidth, qrSize);
    const candidate = 2 * padX + requiredInner;
    const nextWidth = Math.max(
      stampWidthMin,
      Math.min(stampWidthMax, Math.ceil(candidate))
    );
    if (nextWidth !== stampWidth) {
      stampWidth = nextWidth;
      innerWidth = stampWidth - 2 * padX;
      // Recalculate with updated inner width once
      const widthBudget2 = Math.max(16, innerWidth - qrGap - maxTextWidth);
      const rawRatio = Number.isFinite(PDF_META?.qrIdealRatio)
        ? PDF_META.qrIdealRatio
        : 0.46;
      const ratio = Math.min(0.6, Math.max(0.25, rawRatio));
      const idealByInner2 = Math.floor(
        Math.min(innerWidth, innerHeight) * ratio
      );
      qrSize = Math.max(
        qrMin,
        Math.min(qrMaxByHeight, widthBudget2, idealByInner2)
      );
    }
    // Snap to integers to avoid sub-pixel blurring when printing
    qrSize = Math.round(qrSize);
  } finally {
    if (prevFont)
      try {
        doc.font(prevFont);
      } catch {
        /* ignore font restore */
      }
    if (prevSize)
      try {
        doc.fontSize(prevSize);
      } catch {
        /* ignore font restore */
      }
  }
  // Final positions after width adjustment
  const x = doc.page.width - margin - stampWidth;
  qrX = Math.round(x + padX);
  qrY = Math.round(y + padY);
  textX = qrX + qrSize + qrGap;
  // Draw border with the final width
  try {
    doc
      .save()
      .lineWidth(0.6)
      .roundedRect(x, y, stampWidth, stampHeight, 4)
      .stroke(BRAND_BLUE)
      .restore();
  } catch {
    /* noop */
  }
  // Standardized QR payload across documents — prefer compact short URL
  const payload = await (async () => {
    const d = info.docId || '';
    const s = info.signId || '';
    const u = info.userId || '';
    try {
      const { buildShortVerifyUrl } = await import(
        '../services/shortLinkService.js'
      );
      try {
        return await buildShortVerifyUrl({ d, s, u });
      } catch {
        // If short links disabled/unavailable, fallback to long verify URL
        return buildVerifyUrl({ d, s, u });
      }
    } catch {
      try {
        return buildVerifyUrl({ d, s, u });
      } catch {
        return `DOC:${String(d)};SIGN:${String(s)};USER:${String(u)}`;
      }
    }
  })();
  let qrModule;
  try {
    qrModule = await import('qrcode');
  } catch {
    qrModule = null;
  }
  const qrNamespace =
    qrModule && typeof qrModule === 'object'
      ? typeof qrModule.default === 'object' && qrModule.default
        ? qrModule.default
        : qrModule
      : null;
  const qrCreate =
    qrNamespace && typeof qrNamespace.create === 'function'
      ? qrNamespace.create
      : null;
  const qrToDataURL =
    qrNamespace && typeof qrNamespace.toDataURL === 'function'
      ? qrNamespace.toDataURL
      : null;
  // Prefer vector modules to avoid raster blurring when scaling/printing
  let drewVector = false;
  let wantRasterFallback = false;
  const drawQrFallbackOutline = () => {
    try {
      doc
        .save()
        .lineWidth(0.6)
        .rect(qrX, qrY, qrSize, qrSize)
        .stroke(BRAND_BLUE)
        .restore();
    } catch {
      /* noop */
    }
  };
  if (qrCreate) {
    try {
      const levels = ['H', 'Q', 'M', 'L'];
      let chosen = null;
      let chosenMeta = null;
      for (const lvl of levels) {
        try {
          const qrObj = qrCreate(payload, { errorCorrectionLevel: lvl });
          const count = qrObj.modules.size;
          const data = qrObj.modules.data; // boolean-flat array size*size
          const quietModules = Math.max(2, PDF_META?.qrQuietZoneModules || 4);
          const moduleSizeCandidate = Math.floor(
            qrSize / (count + 2 * quietModules)
          );
          if (moduleSizeCandidate >= 1) {
            chosen = qrObj;
            chosenMeta = {
              count,
              data,
              moduleSize: moduleSizeCandidate,
              quietPx: moduleSizeCandidate * quietModules,
            };
            break;
          }
        } catch {
          // try next level
        }
      }
      if (chosen && chosenMeta) {
        const { count, data, moduleSize, quietPx } = chosenMeta;
        const ox = qrX + quietPx;
        const oy = qrY + quietPx;
        doc.save();
        doc.fillColor(BRAND_BLUE);
        for (let yy = 0; yy < count; yy += 1) {
          for (let xx = 0; xx < count; xx += 1) {
            if (data[yy * count + xx]) {
              const rx = ox + xx * moduleSize;
              const ry = oy + yy * moduleSize;
              doc.rect(rx, ry, moduleSize, moduleSize);
            }
          }
        }
        doc.fill();
        doc.restore();
        drewVector = true;
      } else {
        wantRasterFallback = true;
      }
    } catch {
      drewVector = false;
    }
  }
  if (!drewVector) {
    if (qrToDataURL) {
      try {
        // Attempt raster with adaptive ECC if vector was rejected due to density
        const levels = wantRasterFallback ? ['M', 'L'] : ['H', 'Q', 'M', 'L'];
        let dataUrl;
        // Compute a conservative margin to keep the image inside bounds
        const marginModules = Math.max(0, PDF_META?.qrQuietZoneModules || 4);
        for (const lvl of levels) {
          try {
            dataUrl = await qrToDataURL(payload, {
              errorCorrectionLevel: lvl,
              margin: marginModules,
              width: qrSize,
              color: { dark: BRAND_BLUE, light: '#00000000' },
            });
            if (dataUrl) break;
          } catch {
            /* try next level */
          }
        }
        if (dataUrl) {
          doc.image(dataUrl, qrX, qrY, { width: qrSize, height: qrSize });
        } else {
          drawQrFallbackOutline();
        }
      } catch {
        drawQrFallbackOutline();
      }
    } else {
      drawQrFallbackOutline();
    }
  }
  // Text content — brand blue (layout synced with QR height)
  try {
    // Smaller type and tight rhythm. Compute spacing so 4 lines equal QR height
    doc.fontSize(8).fillColor(BRAND_BLUE);
    // Measure regular line height
    let textH;
    try {
      doc.font('SB-Regular');
      textH = Math.ceil(doc.currentLineHeight(true));
    } catch {
      textH = Math.ceil(doc.currentLineHeight(true));
    }
    const totalText = textH * 4;
    const remaining = Math.max(0, qrSize - totalText);
    const gap = Math.floor(remaining / 3);
    const rem = remaining - gap * 3;
    const line1Y = qrY + Math.floor(rem / 2);
    const line2Y = line1Y + textH + gap;
    const line3Y = line2Y + textH + gap;
    const line4Y = line3Y + textH + gap;
    // Bold title with safe fallbacks
    try {
      doc.font('SB-Bold');
    } catch {
      try {
        doc.font('Default-Bold');
      } catch {
        try {
          doc.font('Helvetica-Bold');
        } catch {
          /* keep current */
        }
      }
    }
    doc.text(title, textX, line1Y, { lineBreak: false });
    // Regular for the rest
    try {
      doc.font('SB-Regular');
    } catch {
      try {
        doc.font('Default-Regular');
      } catch {
        try {
          doc.font('Helvetica');
        } catch {
          /* keep current */
        }
      }
    }
    doc.text(fio, textX, line2Y, { lineBreak: false });
    doc.text(`Дата подписания: ${dtText}`, textX, line3Y, { lineBreak: false });
    doc.text(pageInfo, textX, line4Y, { lineBreak: false });
  } catch {
    /* noop */
  }
  doc.fillColor('black');
}
