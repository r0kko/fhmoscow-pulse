import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const docFindByPk = jest.fn();
const docUserSignFindOne = jest.fn().mockResolvedValue({
  id: 'sig',
  created_at: new Date(),
});
const saveGeneratedPdf = jest.fn();
const removeFile = jest.fn();
const getDownloadUrl = jest.fn();

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
  Document: { findByPk: docFindByPk },
  DocumentStatus: { findOne: jest.fn() },
  DocumentType: { findByPk: jest.fn() },
  File: {},
  DocumentUserSign: {
    findOne: docUserSignFindOne,
  },
  SignType: { findOne: jest.fn() },
  UserSignType: {},
  User: { findByPk: jest.fn() },
}));

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    saveGeneratedPdf,
    removeFile,
    getDownloadUrl,
  },
}));

const { default: documentService } =
  await import('../src/services/documentService.js');

beforeEach(() => {
  docFindByPk.mockReset();
  docUserSignFindOne.mockReset();
  saveGeneratedPdf.mockReset();
  removeFile.mockReset();
  getDownloadUrl.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const baseDoc = {
  id: 'doc-x',
  name: 'Doc',
  number: '1',
  document_date: new Date(),
  file_id: 5,
  recipient: { id: 'u1', last_name: 'Last', first_name: 'First' },
  DocumentStatus: { alias: 'SIGNED' },
  update: jest.fn().mockResolvedValue({}),
};

async function run(alias) {
  docFindByPk.mockResolvedValue({
    ...baseDoc,
    DocumentType: { alias, generated: true, name: alias },
  });
  saveGeneratedPdf.mockResolvedValue({ id: 99 });
  getDownloadUrl.mockResolvedValue('https://url');
  const result = await documentService.regenerate('doc-x', 'actor');
  expect(result.file.id).toBe(99);
  expect(saveGeneratedPdf).toHaveBeenCalledWith(
    expect.any(Buffer),
    'Doc.pdf',
    'actor'
  );
  expect(removeFile).toHaveBeenCalledWith(5);
}

test('regenerate uses personal data consent builder', async () => {
  await run('PERSONAL_DATA_CONSENT');
});

test('regenerate uses electronic interaction agreement builder', async () => {
  await run('ELECTRONIC_INTERACTION_AGREEMENT');
});

test('regenerate uses referee contract application builder', async () => {
  await run('REFEREE_CONTRACT_APPLICATION');
});
