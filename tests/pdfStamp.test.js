import { beforeEach, expect, jest, test } from '@jest/globals';

let rectCalls;
let imageCalls;
let textCalls;
let setFontSize = 8;

function makeDocStub({ page = { width: 595, height: 842 } } = {}) {
  rectCalls = [];
  imageCalls = [];
  textCalls = [];
  const doc = {
    page,
    save: jest.fn(() => doc),
    restore: jest.fn(() => doc),
    lineWidth: jest.fn(() => doc),
    roundedRect: jest.fn(() => doc),
    stroke: jest.fn(() => doc),
    opacity: jest.fn(() => doc),
    rect: jest.fn((x, y, w, h) => {
      rectCalls.push({ x, y, w, h });
      return doc;
    }),
    fill: jest.fn(() => doc),
    image: jest.fn((...args) => {
      imageCalls.push(args);
      return doc;
    }),
    text: jest.fn((...args) => {
      textCalls.push(args);
      return doc;
    }),
    fillColor: jest.fn(() => doc),
    fontSize: jest.fn((n) => {
      setFontSize = n;
      return doc;
    }),
    font: jest.fn(() => doc),
    widthOfString: jest.fn((s) => {
      // Deterministic pseudo-metrics: 0.5em per glyph at 8pt
      // Scale roughly linearly with font size.
      const factor = (setFontSize || 8) / 8;
      const len = String(s || '').length;
      return Math.ceil(len * 4 * factor);
    }),
    currentLineHeight: jest.fn(() => 9),
    _font: { name: 'Helvetica' },
    _fontSize: 8,
    x: 0,
    y: 0,
  };
  return doc;
}

beforeEach(() => {
  jest.resetModules();
});

async function setupWithMeta(meta = {}) {
  jest.unstable_mockModule('../src/config/pdf.js', () => ({
    __esModule: true,
    PDF_FONTS: {
      regular: undefined,
      bold: undefined,
      italic: undefined,
      boldItalic: undefined,
    },
    PDF_LOGOS: {},
    PDF_META: {
      stampWidth: 270,
      stampHeight: 66,
      stampPadX: 10,
      stampPadY: 8,
      stampGap: 10,
      qrMinSize: 40,
      qrQuietZoneModules: 4,
      qrIdealRatio: 0.46,
      ...meta,
    },
  }));
  // Force QR fallback branch (no vector/raster encoder)
  jest.unstable_mockModule('qrcode', () => ({ __esModule: true, default: {} }));
  return import('../src/utils/pdf.js');
}

test('QR fits inside stamp and respects min height at defaults', async () => {
  const { applyESignStamp } = await setupWithMeta();
  const doc = makeDocStub();
  // A typical signer info
  await applyESignStamp(doc, {
    fio: 'Иванов Иван Иванович',
    signedAt: new Date('2024-05-20T12:34:00+03:00').toISOString(),
    userId: 'u1',
    docId: 'd1',
    signId: 's1',
    page: 1,
    total: 1,
  });
  // QR fallback draws a single bounding rect with equal sides
  const qrRect = rectCalls.find((c) => c.w === c.h);
  expect(qrRect).toBeDefined();
  const { w, h } = qrRect;
  expect(w).toBe(h);
  // Default min size is 40
  expect(w).toBeGreaterThanOrEqual(40);
  // Must not exceed inner height 66 - 2*8 = 50
  expect(w).toBeLessThanOrEqual(50);
});

test('QR scales up with taller stamp when space allows', async () => {
  const { applyESignStamp } = await setupWithMeta({ stampHeight: 130 });
  const doc = makeDocStub();
  await applyESignStamp(doc, {
    fio: 'Иванов Иван Иванович',
    signedAt: new Date('2024-05-20T12:34:00+03:00').toISOString(),
    userId: 'u1',
    docId: 'd1',
    signId: 's1',
    page: 1,
    total: 1,
  });
  const qrRect = rectCalls.find((c) => c.w === c.h);
  expect(qrRect).toBeDefined();
  // For stampHeight=130, innerHeight=114, ideal≈52 (>40). Expect > 40 and <= 114
  expect(qrRect.w).toBeGreaterThan(40);
  expect(qrRect.w).toBeLessThanOrEqual(114);
});

test('QR always remains within inner box boundaries', async () => {
  const meta = {
    stampWidth: 270,
    stampHeight: 66,
    stampPadX: 10,
    stampPadY: 8,
  };
  const { applyESignStamp } = await setupWithMeta(meta);
  const doc = makeDocStub();
  await applyESignStamp(doc, {
    fio: 'ОченьДлинноеФИОФИОФИОФИОФИОФИОФИОФИО',
    signedAt: new Date('2024-05-20T12:34:00+03:00').toISOString(),
    userId: 'u1',
    docId: 'd1',
    signId: 's1',
    page: 1,
    total: 3,
  });
  const qrRect = rectCalls.find((c) => c.w === c.h);
  expect(qrRect).toBeDefined();
  const innerX = doc.page.width - 30 - meta.stampWidth + meta.stampPadX;
  const innerY =
    doc.page.height - 30 - 44 - meta.stampHeight - 6 + meta.stampPadY;
  const innerRight = innerX + (meta.stampWidth - 2 * meta.stampPadX);
  const innerBottom = innerY + (meta.stampHeight - 2 * meta.stampPadY);
  expect(qrRect.x).toBeGreaterThanOrEqual(innerX);
  expect(qrRect.y).toBeGreaterThanOrEqual(innerY);
  expect(qrRect.x + qrRect.w).toBeLessThanOrEqual(innerRight);
  expect(qrRect.y + qrRect.h).toBeLessThanOrEqual(innerBottom);
});
