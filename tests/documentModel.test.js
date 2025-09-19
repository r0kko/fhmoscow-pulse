import { jest, expect, test } from '@jest/globals';

import { Sequelize } from 'sequelize';

// Create isolated Sequelize instance; connection calls are mocked
const sequelize = new Sequelize('postgres://user:pass@localhost:5432/db', {
  logging: false,
});

// Mock query before importing model to avoid real DB calls
sequelize.query = jest.fn().mockResolvedValue([{ nextval: 7 }]);

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: sequelize,
}));

const { default: Document } = await import('../src/models/document.js');

const DocumentStatusMock = { findByPk: jest.fn() };
const DocumentTypeMock = { findByPk: jest.fn() };
const SignTypeMock = { findOne: jest.fn() };
const UserSignTypeMock = {
  findOne: jest.fn(),
  destroy: jest.fn(),
  create: jest.fn(),
};

Object.assign(sequelize.models, {
  DocumentStatus: DocumentStatusMock,
  DocumentType: DocumentTypeMock,
  SignType: SignTypeMock,
  UserSignType: UserSignTypeMock,
});

const consoleErrorSpy = jest
  .spyOn(console, 'error')
  .mockImplementation(() => {});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

beforeEach(() => {
  DocumentStatusMock.findByPk.mockReset();
  DocumentTypeMock.findByPk.mockReset();
  SignTypeMock.findOne.mockReset();
  UserSignTypeMock.findOne.mockReset();
  UserSignTypeMock.destroy.mockReset();
  UserSignTypeMock.create.mockReset();
});

test('generates document number before validation', async () => {
  const doc = Document.build({
    recipient_id: 'u1',
    document_type_id: 't1',
    status_id: 's1',
    file_id: 'f1',
    sign_type_id: 'st1',
    name: 'Test Doc',
    document_date: new Date('2025-04-10'),
  });
  await doc.validate();
  expect(doc.number).toBe('25.04/7');
});

test('keeps existing document number without querying sequence', async () => {
  sequelize.query.mockClear();
  const doc = Document.build({
    recipient_id: 'u1',
    document_type_id: 't1',
    status_id: 's1',
    file_id: 'f1',
    sign_type_id: 'st1',
    name: 'Preset Doc',
    document_date: new Date('2025-04-10'),
    number: '25.04/99',
  });
  await doc.validate();
  expect(doc.number).toBe('25.04/99');
  expect(sequelize.query).not.toHaveBeenCalled();
});

test('afterUpdate syncs user sign type when agreement gets signed', async () => {
  DocumentStatusMock.findByPk.mockResolvedValue({ alias: 'SIGNED' });
  DocumentTypeMock.findByPk.mockResolvedValue({
    alias: 'ELECTRONIC_INTERACTION_AGREEMENT',
  });
  SignTypeMock.findOne.mockResolvedValue({ id: 'simple-sign' });
  UserSignTypeMock.findOne.mockResolvedValue(null);
  UserSignTypeMock.destroy.mockResolvedValue();
  UserSignTypeMock.create.mockResolvedValue();

  const doc = Document.build({
    id: 'doc-1',
    recipient_id: 'user-1',
    document_type_id: 'type-1',
    status_id: 'status-new',
  });
  doc.setDataValue('updated_by', 'actor-1');
  doc._previousDataValues.status_id = 'status-old';

  await Document.runHooks('afterUpdate', doc, { transaction: { id: 'tx' } });

  expect(DocumentStatusMock.findByPk).toHaveBeenCalledWith('status-new', {
    attributes: ['alias'],
    transaction: { id: 'tx' },
  });
  expect(DocumentTypeMock.findByPk).toHaveBeenCalledWith('type-1', {
    attributes: ['alias'],
    transaction: { id: 'tx' },
  });
  expect(SignTypeMock.findOne).toHaveBeenCalledWith({
    where: { alias: 'SIMPLE_ELECTRONIC' },
    attributes: ['id'],
    transaction: { id: 'tx' },
  });
  expect(UserSignTypeMock.destroy).toHaveBeenCalledWith({
    where: { user_id: 'user-1' },
    transaction: { id: 'tx' },
  });
  const [createdPayload, createOpts] = UserSignTypeMock.create.mock.calls[0];
  expect(createdPayload.user_id).toBe('user-1');
  expect(createdPayload.sign_type_id).toBe('simple-sign');
  expect(createdPayload.created_by).toBeNull();
  expect(createdPayload.updated_by).toBeNull();
  expect(createOpts).toEqual({ transaction: { id: 'tx' } });
});

test('afterUpdate exits early when status unchanged', async () => {
  DocumentStatusMock.findByPk.mockClear();
  const doc = Document.build({ status_id: 'status-same' });
  doc._previousDataValues.status_id = 'status-same';

  await Document.runHooks('afterUpdate', doc, {});

  expect(DocumentStatusMock.findByPk).not.toHaveBeenCalled();
  expect(UserSignTypeMock.destroy).not.toHaveBeenCalled();
  expect(UserSignTypeMock.create).not.toHaveBeenCalled();
});
