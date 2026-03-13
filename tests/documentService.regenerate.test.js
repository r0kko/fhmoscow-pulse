import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const docFindByPk = jest.fn();
const docUserSignFindOne = jest.fn();
const docUserSignFindAll = jest.fn();
const saveGeneratedPdf = jest.fn();
const removeFile = jest.fn();
const getDownloadUrl = jest.fn();
const bankPdfBuilder = jest.fn();
const equipmentPdfBuilder = jest.fn();
const closingPdfBuilder = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Document: { findByPk: docFindByPk },
  DocumentUserSign: {
    findOne: docUserSignFindOne,
    findAll: docUserSignFindAll,
  },
  DocumentType: { findByPk: jest.fn() },
  DocumentStatus: { findOne: jest.fn() },
  File: {},
  SignType: { findOne: jest.fn() },
  User: { findByPk: jest.fn() },
  UserSignType: { findOne: jest.fn(), destroy: jest.fn(), create: jest.fn() },
}));

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    saveGeneratedPdf,
    removeFile,
    getDownloadUrl,
    uploadDocument: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendDocumentSignedEmail: jest.fn(),
    sendDocumentAwaitingSignatureEmail: jest.fn(),
  },
}));

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

jest.unstable_mockModule(
  '../src/services/docBuilders/bankDetailsChange.js',
  () => ({
    __esModule: true,
    default: bankPdfBuilder,
  })
);

jest.unstable_mockModule(
  '../src/services/docBuilders/equipmentTransfer.js',
  () => ({
    __esModule: true,
    default: equipmentPdfBuilder,
  })
);

jest.unstable_mockModule(
  '../src/services/docBuilders/refereeClosingAct.js',
  () => ({
    __esModule: true,
    default: closingPdfBuilder,
  })
);

const documentModule = await import('../src/services/documentService.js');
const { default: documentService } = documentModule;

beforeEach(() => {
  docFindByPk.mockReset();
  docUserSignFindOne.mockReset();
  docUserSignFindAll.mockReset();
  saveGeneratedPdf.mockReset();
  removeFile.mockReset();
  getDownloadUrl.mockReset();
  bankPdfBuilder.mockReset();
  equipmentPdfBuilder.mockReset();
  closingPdfBuilder.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('regenerate in SIGNED state includes esign metadata from last signature', async () => {
  const signRecord = {
    id: 'sig-1',
    created_at: new Date('2023-01-01T00:00:00Z'),
  };
  docFindByPk.mockResolvedValueOnce({
    id: 'doc-1',
    name: 'Bank change',
    number: '123',
    document_date: new Date('2023-01-02'),
    file_id: 77,
    description: JSON.stringify({ number: '111', bic: '222' }),
    DocumentType: {
      alias: 'BANK_DETAILS_CHANGE',
      generated: true,
      name: 'Bank change',
    },
    DocumentStatus: { alias: 'SIGNED' },
    recipient: { id: 'u1' },
    update: jest.fn().mockResolvedValue({}),
  });
  docUserSignFindOne.mockResolvedValueOnce(signRecord);
  bankPdfBuilder.mockResolvedValue(Buffer.from('pdf'));
  saveGeneratedPdf.mockResolvedValue({ id: 88 });
  getDownloadUrl.mockResolvedValue('https://url');
  const result = await documentService.regenerate('doc-1', 'actor-1');
  expect(bankPdfBuilder).toHaveBeenCalledWith(
    { id: 'u1' },
    { number: '111', bic: '222' },
    expect.objectContaining({
      esign: expect.objectContaining({ signId: 'sig-1' }),
    })
  );
  expect(result.file).toEqual({ id: 88, url: 'https://url' });
  expect(removeFile).toHaveBeenCalledWith(77);
});

test('regenerate enforces status and type validation', async () => {
  docFindByPk.mockResolvedValueOnce(null);
  await expect(
    documentService.regenerate('missing', 'actor')
  ).rejects.toMatchObject({
    code: 'document_not_found',
  });

  docFindByPk.mockResolvedValueOnce({
    DocumentType: { generated: false },
  });
  await expect(
    documentService.regenerate('doc', 'actor')
  ).rejects.toMatchObject({
    code: 'document_type_not_generated',
  });

  docFindByPk.mockResolvedValueOnce({
    DocumentType: {
      generated: true,
      alias: 'BANK_DETAILS_CHANGE',
      name: 'Bank change',
    },
    DocumentStatus: { alias: 'ARCHIVED' },
  });
  await expect(
    documentService.regenerate('doc', 'actor')
  ).rejects.toMatchObject({
    code: 'document_status_invalid',
  });
});

test('regenerate attaches download URL and cleans old file', async () => {
  const updateMock = jest.fn().mockResolvedValue({});
  docFindByPk.mockResolvedValueOnce({
    id: 'doc-10',
    name: 'EIA',
    number: '55',
    document_date: new Date('2023-02-01'),
    file_id: 5,
    description: JSON.stringify({ equipment: { id: 'eq' } }),
    DocumentType: {
      generated: true,
      alias: 'ELECTRONIC_INTERACTION_AGREEMENT',
      name: 'Transfer',
    },
    DocumentStatus: { alias: 'CREATED' },
    recipient: { last_name: 'Ivanov', first_name: 'Ivan', patronymic: 'I.' },
    update: updateMock,
  });
  saveGeneratedPdf.mockResolvedValue({ id: 99 });
  getDownloadUrl.mockResolvedValue('https://signed');
  const result = await documentService.regenerate('doc-10', 'actor');
  expect(result.file).toEqual({ id: 99, url: 'https://signed' });
  expect(removeFile).toHaveBeenCalledWith(5);
  expect(updateMock).toHaveBeenCalledWith({ file_id: 99, updated_by: 'actor' });
});

test('regenerate uses closing act builder with signature timeline', async () => {
  docFindByPk.mockResolvedValueOnce({
    id: 'doc-closing',
    name: 'Closing act',
    number: 'CA-1',
    document_date: new Date('2026-03-12T00:00:00Z'),
    file_id: 14,
    recipient_id: 'ref-1',
    description: JSON.stringify({
      payload: {
        customer: { name: 'Организатор' },
        performer: { full_name: 'Судья', address: 'Москва' },
        contract: { number: '26.03/1024', document_date: '2026-03-12' },
        fhmo_signer: { full_name: 'Специалист ФХМ' },
        totals: { total_amount_rub: '1500.00', total_amount_words: 'Одна тысяча пятьсот рублей 00 копеек' },
        items: [{ service_name: 'Матч 1', total_amount_rub: '1500.00' }],
      },
    }),
    DocumentType: {
      alias: 'REFEREE_CLOSING_ACT',
      generated: true,
      name: 'Закрывающий акт',
    },
    DocumentStatus: { alias: 'AWAITING_SIGNATURE' },
    recipient: { id: 'ref-1', last_name: 'Судья', first_name: 'Иван' },
    update: jest.fn().mockResolvedValue({}),
  });
  docUserSignFindAll.mockResolvedValueOnce([
    {
      id: 'sig-1',
      user_id: 'fhmo-1',
      created_at: new Date('2026-03-12T09:00:00Z'),
      User: {
        id: 'fhmo-1',
        last_name: 'ФХМ',
        first_name: 'Специалист',
        patronymic: '',
        Roles: [
          {
            alias: 'FHMO_JUDGING_LEAD_SPECIALIST',
            name: 'Ведущий специалист',
          },
        ],
      },
      SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
    },
  ]);
  closingPdfBuilder.mockResolvedValue(Buffer.from('pdf-closing'));
  saveGeneratedPdf.mockResolvedValue({ id: 101 });
  getDownloadUrl.mockResolvedValue('https://url/closing');

  const result = await documentService.regenerate('doc-closing', 'actor-1');

  expect(closingPdfBuilder).toHaveBeenCalledWith(
    expect.objectContaining({
      customer: { name: 'Организатор' },
      contract: { number: '26.03/1024', document_date: '2026-03-12' },
      items: [{ service_name: 'Матч 1', total_amount_rub: '1500.00' }],
    }),
    expect.objectContaining({
      docId: 'doc-closing',
      number: 'CA-1',
      signatures: [
        expect.objectContaining({
          sign_id: 'sig-1',
          party: 'FHMO',
        }),
      ],
    })
  );
  expect(result.file).toEqual({ id: 101, url: 'https://url/closing' });
  expect(removeFile).toHaveBeenCalledWith(14);
});
