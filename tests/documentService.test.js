import { expect, jest, test } from '@jest/globals';

const findByPkMock = jest.fn();
const findDocMock = jest.fn();
const findAllMock = jest.fn();
const createMock = jest.fn();
const findExistingMock = jest.fn();
const destroyMock = jest.fn();
const findStatusMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findByPk: findByPkMock },
  Document: { findOne: findDocMock },
  DocumentType: {},
  DocumentStatus: { findOne: findStatusMock },
  UserDocument: {
    findAll: findAllMock,
    create: createMock,
    findOne: findExistingMock,
    findByPk: findByPkMock,
  },
}));

const { default: service } = await import('../src/services/documentService.js');

findByPkMock.mockResolvedValue({});
findDocMock.mockResolvedValue({ id: 'd1' });
findExistingMock.mockResolvedValue(null);
createMock.mockResolvedValue({ id: 'ud1' });
findAllMock.mockResolvedValue([]);
findStatusMock.mockResolvedValue({ id: 's1' });

test('createForUser throws when user missing', async () => {
  findByPkMock.mockResolvedValueOnce(null);
  await expect(
    service.createForUser('u', 'DOC', {}, 'a')
  ).rejects.toThrow('user_not_found');
});

test('createForUser throws when document missing', async () => {
  findByPkMock.mockResolvedValue({});
  findDocMock.mockResolvedValueOnce(null);
  await expect(
    service.createForUser('u', 'DOC', {}, 'a')
  ).rejects.toThrow('document_not_found');
});


test('createForUser creates record', async () => {
  const data = { signing_date: '2024-01-01T12:00:00Z' };
  const res = await service.createForUser('u', 'DOC', data, 'a');
  expect(findStatusMock).toHaveBeenCalledWith({ where: { alias: 'ACTIVE' } });
  expect(createMock).toHaveBeenCalledWith({
    user_id: 'u',
    document_id: 'd1',
    status_id: 's1',
    signing_date: data.signing_date,
    valid_until: undefined,
    created_by: 'a',
    updated_by: 'a',
  });
  expect(res).toEqual({ id: 'ud1' });
});

test('createForUser throws when status missing', async () => {
  findStatusMock.mockResolvedValueOnce(null);
  await expect(
    service.createForUser('u', 'DOC', {}, 'a')
  ).rejects.toThrow('status_not_found');
});
