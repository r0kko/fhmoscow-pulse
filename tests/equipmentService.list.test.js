import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const findAndCountAllMock = jest.fn();
const countMock = jest.fn();
const findOneMock = jest.fn();

const equipmentModelMock = {
  findAndCountAll: findAndCountAllMock,
  count: countMock,
  findOne: findOneMock,
};

const noopModel = {};

beforeEach(() => {
  findAndCountAllMock.mockReset();
  countMock.mockReset();
  findOneMock.mockReset();
});

jest.unstable_mockModule('../src/services/docBuilders/equipmentTransfer.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: { saveGeneratedPdf: jest.fn() },
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  sendDocumentCreatedEmail: jest.fn(),
  sendDocumentAwaitingSignatureEmail: jest.fn(),
}));

jest.unstable_mockModule('../src/services/documentService.js', () => ({
  __esModule: true,
  default: { regenerate: jest.fn() },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Equipment: equipmentModelMock,
  EquipmentType: noopModel,
  EquipmentManufacturer: noopModel,
  EquipmentSize: noopModel,
  Document: noopModel,
  DocumentStatus: noopModel,
  User: noopModel,
  Role: noopModel,
  DocumentType: noopModel,
  SignType: noopModel,
  UserSignType: noopModel,
}));

const { default: service } = await import('../src/services/equipmentService.js');

describe('equipmentService.listAll', () => {
  test('returns paginated list with summary and search filters applied', async () => {
    findAndCountAllMock.mockResolvedValue({
      rows: [{ id: 'eq1' }],
      count: 8,
    });
    countMock
      .mockResolvedValueOnce(4) // free
      .mockResolvedValueOnce(3) // awaiting
      .mockResolvedValueOnce(1); // issued
    findOneMock
      .mockResolvedValueOnce({ updatedAt: new Date('2024-01-15T10:00:00Z') })
      .mockResolvedValueOnce({ createdAt: new Date('2024-01-10T09:30:00Z') });

    const result = await service.listAll({
      page: 2,
      limit: 25,
      type_id: 'type-1',
      orderBy: 'updated_at',
      order: 'desc',
      status: 'free',
      search: '123 helmet',
    });

    expect(findAndCountAllMock).toHaveBeenCalledTimes(1);
    const listArgs = findAndCountAllMock.mock.calls[0][0];
    expect(listArgs.limit).toBe(25);
    expect(listArgs.offset).toBe(25);
    expect(listArgs.where.type_id).toBe('type-1');
    expect(listArgs.where.owner_id).toBeNull();
    expect(listArgs.order).toEqual([['updatedAt', 'DESC']]);
    expect(listArgs.subQuery).toBe(false);
    expect(listArgs.distinct).toBe(true);

    const searchConditions = listArgs.where[Op.and];
    expect(Array.isArray(searchConditions)).toBe(true);
    const flattened = searchConditions.flatMap((cond) => cond[Op.or] || []);
    const numberCondition = flattened.find((cond) => cond?.number != null);
    expect(numberCondition?.number).toBe(123);

    expect(countMock).toHaveBeenCalledTimes(3);
    const freeWhere = countMock.mock.calls[0][0].where;
    expect(freeWhere.owner_id).toBeNull();
    expect(freeWhere.assignment_document_id).toBeNull();
    const awaitingWhere = countMock.mock.calls[1][0].where;
    expect(awaitingWhere.owner_id).toBeNull();
    expect(awaitingWhere.assignment_document_id[Op.ne]).toBeNull();
    const issuedWhere = countMock.mock.calls[2][0].where;
    expect(issuedWhere.owner_id[Op.ne]).toBeNull();

    expect(result.rows).toEqual([{ id: 'eq1' }]);
    expect(result.count).toBe(8);
    expect(result.summary).toEqual({
      total: 8,
      free: 4,
      awaiting: 3,
      issued: 1,
      lastUpdatedAt: '2024-01-15T10:00:00.000Z',
      lastCreatedAt: '2024-01-10T09:30:00.000Z',
    });
  });
});
