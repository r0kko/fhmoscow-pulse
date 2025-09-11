import { expect, jest, test, beforeEach } from '@jest/globals';

// Mocks for downstream services
const createForUserMock = jest.fn();
const updateMock = jest.fn();
const createDocMock = jest.fn();
const dadataFindBankMock = jest.fn();

jest.unstable_mockModule('../src/services/ticketService.js', () => ({
  __esModule: true,
  default: {
    createForUser: createForUserMock,
    update: updateMock,
  },
}));

jest.unstable_mockModule('../src/services/documentService.js', () => ({
  __esModule: true,
  default: {
    createBankDetailsChangeDocument: createDocMock,
  },
}));

jest.unstable_mockModule('../src/services/dadataService.js', () => ({
  __esModule: true,
  default: { findBankByBic: dadataFindBankMock },
}));

// Minimal models used inside the service
let userHasSimple = false;
jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  TicketType: {
    findOne: jest.fn(async ({ where }) => ({ id: 'tt', alias: where.alias })),
  },
  TicketStatus: {
    findAll: jest.fn(async ({ where }) =>
      (where.alias || []).map((a) => ({ id: a.toLowerCase(), alias: a }))
    ),
  },
  Ticket: { findOne: jest.fn(async () => null) },
  TicketFile: { create: jest.fn(async () => ({})) },
  File: { findByPk: jest.fn(async (id) => ({ id })) },
  UserSignType: {
    findOne: jest.fn(async () =>
      userHasSimple
        ? { SignType: { alias: 'SIMPLE_ELECTRONIC', id: 'sig' } }
        : null
    ),
  },
  SignType: {},
}));

const { default: bankAccountChangeService } = await import(
  '../src/services/bankAccountChangeService.js'
);

beforeEach(() => {
  createForUserMock.mockReset();
  updateMock.mockReset();
  createDocMock.mockReset();
  dadataFindBankMock.mockReset();
  userHasSimple = false;
});

test('rejects early without SIMPLE_ELECTRONIC signature', async () => {
  dadataFindBankMock.mockResolvedValue({ value: 'Банк', data: {} });
  await expect(
    bankAccountChangeService.requestChange(
      { id: 'u1' },
      { number: '40702810900000005555', bic: '044525225' }
    )
  ).rejects.toMatchObject({ code: 'sign_type_simple_required' });
  expect(createForUserMock).not.toHaveBeenCalled();
  expect(createDocMock).not.toHaveBeenCalled();
});

test('creates ticket and document silently when signature is present', async () => {
  userHasSimple = true;
  dadataFindBankMock.mockResolvedValue({
    value: 'ПАО Тест Банк',
    data: {
      correspondent_account: '30101810400000000225',
      swift: 'TESTRUMM',
      inn: '7700000000',
      kpp: '770001001',
      address: { unrestricted_value: 'г. Москва, ул. Тестовая, д. 1' },
    },
  });
  createForUserMock.mockResolvedValue({ id: 't1' });
  updateMock.mockResolvedValue({});
  createDocMock.mockResolvedValue({
    document: { id: 'd1' },
    file: { id: 'f1' },
  });

  const res = await bankAccountChangeService.requestChange(
    { id: 'u1' },
    { number: '40702810900000005555', bic: '044525225' }
  );

  expect(createForUserMock).toHaveBeenCalledWith(
    'u1',
    expect.any(Object),
    'u1',
    { notify: false }
  );
  expect(updateMock).toHaveBeenCalledWith(
    't1',
    { status_alias: 'IN_PROGRESS' },
    'u1',
    {
      notify: false,
    }
  );
  expect(createDocMock).toHaveBeenCalledWith(
    'u1',
    expect.objectContaining({
      number: '40702810900000005555',
      bic: '044525225',
    }),
    'u1',
    { notify: false }
  );
  expect(res).toEqual({ ticket: expect.any(Object), document: { id: 'd1' } });
});
