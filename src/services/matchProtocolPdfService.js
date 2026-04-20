import crypto from 'crypto';
import fs from 'fs/promises';

import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';

import logger from '../../logger.js';
import {
  MATCH_PROTOCOL_CONFIG,
  MATCH_PROTOCOL_RENDER_VERSION,
} from '../config/matchProtocol.js';
import { applyESignStamp, applyFonts } from '../utils/pdf.js';

let sealCachePromise = null;

function collectPdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function computeSealPlacement(pageWidth, pageHeight, imageWidth, imageHeight) {
  const targetWidth = Math.max(
    44,
    Math.round(pageWidth * MATCH_PROTOCOL_CONFIG.sealScaleRatio)
  );
  const ratio = imageHeight > 0 ? imageWidth / imageHeight : 1;
  const targetHeight = Math.max(
    44,
    Math.round(targetWidth / Math.max(ratio, 0.1))
  );
  const centerX = Math.round(pageWidth * MATCH_PROTOCOL_CONFIG.sealCenterXRatio);
  const centerY = Math.round(pageHeight * MATCH_PROTOCOL_CONFIG.sealCenterYRatio);
  const x = Math.round(centerX - targetWidth / 2);
  const y = Math.round(centerY - targetHeight / 2);
  return {
    x: Math.max(0, Math.min(pageWidth - targetWidth, x)),
    y: Math.max(0, Math.min(pageHeight - targetHeight, y)),
    width: targetWidth,
    height: targetHeight,
  };
}

function drawCopyTrueStamp(doc, { number }) {
  const width = 72;
  const height = 40;
  const qrSize = 40;
  const qrRightOffset = 18;
  const qrTopOffset = 18;
  const x = Math.max(
    8,
    Math.round(doc.page.width - qrRightOffset - qrSize - 18 - width)
  );
  const y = Math.max(8, Math.round(qrTopOffset + 6));
  const color = '#113867';
  try {
    doc
      .save()
      .fillColor('#ffffff')
      .opacity(0.35)
      .roundedRect(x, y, width, height, 4)
      .fill()
      .restore();
  } catch {
    /* noop */
  }
  try {
    doc
      .save()
      .lineWidth(0.6)
      .roundedRect(x, y, width, height, 4)
      .stroke(color)
      .restore();
  } catch {
    /* noop */
  }
  try {
    const fontSize = 7;
    const lineGap = 2;
    doc.fontSize(fontSize).fillColor(color);
    try {
      doc.font('SB-Bold');
    } catch {
      try {
        doc.font('Default-Bold');
      } catch {
        doc.font('Helvetica-Bold');
      }
    }
    const titleHeight = Math.ceil(doc.currentLineHeight(true)) || fontSize + 1;
    try {
      doc.font('SB-Regular');
    } catch {
      try {
        doc.font('Default-Regular');
      } catch {
        doc.font('Helvetica');
      }
    }
    const numberHeight = Math.ceil(doc.currentLineHeight(true)) || fontSize + 1;
    const totalHeight = titleHeight + lineGap + numberHeight;
    const startY = y + Math.max(0, Math.floor((height - totalHeight) / 2));
    const titleY = startY;
    const numberY = startY + titleHeight + lineGap;
    try {
      doc.font('SB-Bold');
    } catch {
      try {
        doc.font('Default-Bold');
      } catch {
        doc.font('Helvetica-Bold');
      }
    }
    doc.text('КОПИЯ ВЕРНА', x, titleY, {
      width,
      align: 'center',
      lineBreak: false,
    });
    try {
      doc.font('SB-Regular');
    } catch {
      try {
        doc.font('Default-Regular');
      } catch {
        doc.font('Helvetica');
      }
    }
    doc.text(`№ ${String(number || '').trim() || '—'}`, x, numberY, {
      width,
      align: 'center',
      lineBreak: false,
    });
  } catch {
    /* noop */
  }
}

async function loadSealAsset() {
  if (!sealCachePromise) {
    sealCachePromise = (async () => {
      const source = await fs.readFile(MATCH_PROTOCOL_CONFIG.sealPath);
      const prepared = sharp(source).ensureAlpha();
      const { data, info } = await prepared
        .raw()
        .toBuffer({ resolveWithObject: true });
      const threshold = MATCH_PROTOCOL_CONFIG.sealWhiteThreshold;
      for (let index = 0; index < data.length; index += info.channels) {
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        if (red >= threshold && green >= threshold && blue >= threshold) {
          data[index + 3] = 0;
        }
      }
      const cleaned = await sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: info.channels,
        },
      })
        .modulate({ brightness: 0.9, saturation: 1.25 })
        .sharpen()
        .png()
        .toBuffer();
      return {
        buffer: cleaned,
        width: info.width,
        height: info.height,
        hash: crypto.createHash('sha256').update(cleaned).digest('hex'),
      };
    })().catch((err) => {
      sealCachePromise = null;
      throw err;
    });
  }
  return sealCachePromise;
}

async function buildStampOverlayPage({
  width,
  height,
  matchId,
  snapshotId,
  userId,
  signedAt,
  signer,
  page,
  total,
  documentNumber,
}) {
  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    size: [width, height],
  });
  doc.addPage({ size: [width, height], margin: 0 });
  applyFonts(doc);
  await applyESignStamp(doc, {
    docId: matchId,
    signId: snapshotId,
    userId,
    signedAt,
    signerPosition: signer?.position || null,
    signerDepartment: null,
    signerOrganization: 'РОО "Федерация хоккея Москвы"',
    fio:
      [signer?.last_name, signer?.first_name, signer?.patronymic]
        .filter(Boolean)
        .join(' ') || null,
    title: 'ДОКУМЕНТ ПОДПИСАН ЭП',
    page,
    total,
    verifyKind: 'match_protocol',
    stampWidth: 276,
    stampWidthMin: 236,
    stampHeight: 74,
    padX: 6,
    padY: 4,
    bottomOffset: MATCH_PROTOCOL_CONFIG.signatureBottomOffset,
    rightOffset: MATCH_PROTOCOL_CONFIG.signatureRightOffset,
    showPageInfo: false,
    footerBandHeight: 0,
    backgroundColor: '#ffffff',
    backgroundOpacity: 0.62,
  });
  if (page === 1) {
    drawCopyTrueStamp(doc, {
      number: documentNumber,
    });
  }
  return collectPdfBuffer(doc);
}

export async function renderMatchProtocolPdf({
  sourceBuffer,
  matchId,
  snapshotId,
  documentNumber,
  signer,
  signedAt,
  signedByUserId,
}) {
  const sourcePdf = await PdfLibDocument.load(sourceBuffer);
  const seal = await loadSealAsset();
  const embeddedSeal = await sourcePdf.embedPng(seal.buffer);
  const pageCount = sourcePdf.getPageCount();

  for (let index = 0; index < pageCount; index += 1) {
    const page = sourcePdf.getPage(index);
    const { width, height } = page.getSize();
    const placement = computeSealPlacement(
      width,
      height,
      seal.width,
      seal.height
    );
    page.drawImage(embeddedSeal, {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      opacity: MATCH_PROTOCOL_CONFIG.sealOpacity,
    });

    const overlay = await buildStampOverlayPage({
      width,
      height,
      matchId,
      snapshotId,
      userId: signedByUserId,
      signedAt,
      signer,
      page: index + 1,
      total: pageCount,
      documentNumber,
    });
    const [overlayPage] = await sourcePdf.embedPdf(overlay, [0]);
    page.drawPage(overlayPage);
  }

  sourcePdf.setProducer('FH Moscow Pulse');
  sourcePdf.setCreator('FH Moscow Pulse');
  sourcePdf.setModificationDate(new Date());
  sourcePdf.setTitle('Протокол матча ФХМ');

  const buffer = Buffer.from(await sourcePdf.save());
  logger.info('Match protocol PDF rendered', {
    match_id: matchId,
    snapshot_id: snapshotId,
    render_version: MATCH_PROTOCOL_RENDER_VERSION,
    page_count: pageCount,
  });
  return {
    buffer,
    sealAssetHash: seal.hash,
    renderVersion: MATCH_PROTOCOL_RENDER_VERSION,
  };
}

export default { renderMatchProtocolPdf };
