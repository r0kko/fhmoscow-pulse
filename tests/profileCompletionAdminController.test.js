import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const listByRoleMock = jest.fn();
const toPublicArrayMock = jest.fn();
const hasAnySnilsBulkMock = jest.fn();

jest.unstable_mockModule('../src/services/profileCompletionService.js', () => ({
  __esModule: true,
  default: {
    listByRole: listByRoleMock,
  },
}));

jest.unstable_mockModule('../src/mappers/profileCompletionMapper.js', () => ({
  __esModule: true,
  default: {
    toPublicArray: toPublicArrayMock,
  },
}));

jest.unstable_mockModule('../src/services/snilsService.js', () => ({
  __esModule: true,
  hasAnySnilsBulk: hasAnySnilsBulkMock,
}));

const { default: controller } =
  await import('../src/controllers/profileCompletionAdminController.js');

function mockRes() {
  return {
    locals: {},
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  toPublicArrayMock.mockImplementation((arr) => arr);
});

describe('profileCompletionAdminController', () => {
  test('returns paginated profiles with meta in default mode', async () => {
    listByRoleMock.mockResolvedValue({
      rows: [
        {
          id: 'u1',
          first_name: 'Иван',
          last_name: 'Иванов',
          passport: true,
          inn: true,
          snils: false,
          bank_account: true,
          addresses: true,
          taxation_type: 'НПД',
        },
      ],
      count: 1,
      page: 1,
      pages: 1,
      limit: 20,
    });
    hasAnySnilsBulkMock.mockResolvedValue(new Map([['u1', true]]));

    const req = { query: { page: '1', limit: '20' } };
    const res = mockRes();

    await controller.list(req, res);

    expect(listByRoleMock).toHaveBeenCalledWith(expect.any(Array), {
      search: '',
      page: 1,
      limit: 20,
    });
    expect(res.json).toHaveBeenCalledWith({
      profiles: [
        {
          id: 'u1',
          first_name: 'Иван',
          last_name: 'Иванов',
          passport: true,
          inn: true,
          snils: true,
          bank_account: true,
          addresses: true,
          taxation_type: 'НПД',
        },
      ],
      meta: {
        total: 1,
        page: 1,
        pages: 1,
        limit: 20,
      },
    });
  });

  test('applies completion and snils filters with server-side pagination', async () => {
    listByRoleMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'u1',
            passport: true,
            inn: true,
            snils: false,
            bank_account: true,
            addresses: true,
            taxation_type: 'НПД',
          },
          {
            id: 'u2',
            passport: false,
            inn: true,
            snils: false,
            bank_account: true,
            addresses: true,
            taxation_type: 'НПД',
          },
        ],
        count: 3,
        page: 1,
        pages: 2,
        limit: 100,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'u3',
            passport: true,
            inn: true,
            snils: false,
            bank_account: true,
            addresses: true,
            taxation_type: 'НПД',
          },
        ],
        count: 3,
        page: 2,
        pages: 2,
        limit: 100,
      });

    hasAnySnilsBulkMock
      .mockResolvedValueOnce(
        new Map([
          ['u1', true],
          ['u2', false],
        ])
      )
      .mockResolvedValueOnce(new Map([['u3', true]]));

    const req = {
      query: {
        page: '2',
        limit: '1',
        completionStatus: 'complete',
        hasSnils: 'true',
      },
    };
    const res = mockRes();

    await controller.list(req, res);

    expect(listByRoleMock).toHaveBeenNthCalledWith(1, expect.any(Array), {
      search: '',
      page: 1,
      limit: 100,
    });
    expect(listByRoleMock).toHaveBeenNthCalledWith(2, expect.any(Array), {
      search: '',
      page: 2,
      limit: 100,
    });

    expect(res.json).toHaveBeenCalledWith({
      profiles: [
        {
          id: 'u3',
          passport: true,
          inn: true,
          snils: true,
          bank_account: true,
          addresses: true,
          taxation_type: 'НПД',
        },
      ],
      meta: {
        total: 2,
        page: 2,
        pages: 2,
        limit: 1,
      },
    });
  });
});
