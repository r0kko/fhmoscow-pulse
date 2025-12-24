import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('pdfkit', () => {
  class FakeDoc {
    constructor() {
      this.handlers = {};
      this.page = { width: 800, margins: { left: 10, right: 10 } };
      this.y = 0;
      this.x = 0;
    }
    on(event, cb) {
      this.handlers[event] = cb;
    }
    text() {
      return this;
    }
    font() {
      return this;
    }
    fontSize() {
      return this;
    }
    moveDown() {
      return this;
    }
    fillColor() {
      return this;
    }
    widthOfString() {
      return 10;
    }
    heightOfString() {
      return 10;
    }
    bufferedPageRange() {
      return { start: 0, count: 1 };
    }
    switchToPage() {
      return this;
    }
    save() {
      return this;
    }
    restore() {
      return this;
    }
    rect() {
      return this;
    }
    fill() {
      return this;
    }
    stroke() {
      return this;
    }
    lineWidth() {
      return this;
    }
    strokeColor() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    currentLineHeight() {
      return 12;
    }
    end() {
      this.handlers.data?.(Buffer.from('pdf'));
      this.handlers.end?.();
    }
  }
  return { __esModule: true, default: FakeDoc };
});

jest.unstable_mockModule('../src/utils/pdf.js', () => ({
  __esModule: true,
  applyFonts: () => ({ regular: 'reg', bold: 'bold' }),
  applyFirstPageHeader: () => {},
  applyFooter: () => {},
  applyESignStamp: () => {},
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Document: {},
  DocumentStatus: {},
  DocumentType: {},
  DocumentUserSign: {},
  SignType: {},
  User: {},
  File: {},
  MedicalCertificate: {},
  MedicalCertificateFile: {},
  MedicalCertificateType: {},
  Ticket: {},
  TicketStatus: {},
  TicketType: {},
  TicketFile: {},
  UserSignType: {},
}));

const {
  buildPersonalDataConsentPdf,
  buildElectronicInteractionAgreementPdf,
  buildRefereeContractApplicationPdf,
} = await import('../src/services/documentService.js');

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('personal data consent builder returns buffer', async () => {
  const buf = await buildPersonalDataConsentPdf({ id: 'u1' }, { docId: 'd1' });
  expect(Buffer.isBuffer(buf)).toBe(true);
});

test('electronic interaction agreement builder returns buffer', async () => {
  const buf = await buildElectronicInteractionAgreementPdf(
    { id: 'u1' },
    { docId: 'd2' }
  );
  expect(Buffer.isBuffer(buf)).toBe(true);
});

test('referee contract application builder returns buffer', async () => {
  const buf = await buildRefereeContractApplicationPdf(
    { id: 'u1' },
    { docId: 'd3' }
  );
  expect(Buffer.isBuffer(buf)).toBe(true);
});
