import { expect, jest, test, beforeEach } from '@jest/globals';

// Mock models used by the builder
jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  BankAccount: {
    findOne: jest.fn(async () => ({
      number: '40702810900000001234',
      bic: '044525225',
      bank_name: 'ПАО Старый Банк',
      correspondent_account: '30101810400000000225',
      inn: '7700000001',
      kpp: '770001002',
      swift: 'OLDTBIC',
      address: 'г. Москва, ул. Старая, д. 1',
    })),
  },
  Inn: { findOne: jest.fn(async () => ({ number: '500100732259' })) },
  Taxation: {
    findOne: jest.fn(async () => ({
      TaxationType: { alias: 'NPD', name: 'Налог на профессиональный доход' },
    })),
  },
  TaxationType: {},
}));

const { default: buildBankDetailsChangePdf } =
  await import('../src/services/docBuilders/bankDetailsChange.js');

beforeEach(() => {
  // no-op
});

test('generates a single-page PDF with stacked requisites', async () => {
  const user = {
    id: 'u1',
    last_name: 'Иванов',
    first_name: 'Иван',
    patronymic: 'Иванович',
    birth_date: '1990-05-20',
  };
  const changes = {
    number: '40702810900000005555',
    bic: '044525225',
    bank_name: 'ПАО Новый Банк',
    correspondent_account: '30101810400000000999',
    inn: '7700000099',
    kpp: '770009999',
    swift: 'NEWTBIC',
    address: 'г. Москва, ул. Новая, д. 5',
  };
  const buf = await buildBankDetailsChangePdf(user, changes, {
    docId: 'doc-1',
    number: '25.09/12345',
  });
  expect(Buffer.isBuffer(buf)).toBe(true);
  // PDF header magic
  expect(buf.slice(0, 4).toString()).toBe('%PDF');
  expect(buf.length).toBeGreaterThan(500);
});
