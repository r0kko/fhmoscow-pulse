import { expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const createMock = jest.fn();
const destroyMock = jest.fn();
const findByPkMock = jest.fn();
const findTypeMock = jest.fn();
const findCountryMock = jest.fn();

const passportInstance = { destroy: destroyMock };

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Passport: {
    findOne: findOneMock,
    create: createMock,
  },
  DocumentType: { findOne: findTypeMock },
  Country: { findOne: findCountryMock },
  User: { findByPk: findByPkMock },
}));

const { default: service } = await import('../src/services/passportService.js');

test('getByUser calls model with associations', async () => {
  const pass = { id: 'p1' };
  findOneMock.mockResolvedValue(pass);
  const res = await service.getByUser('u1');
  expect(res).toBe(pass);
  expect(findOneMock).toHaveBeenCalledWith({
    where: { user_id: 'u1' },
    include: [expect.any(Object), expect.any(Object)],
  });
});

test('createForUser validates and creates passport', async () => {
  findByPkMock.mockResolvedValue({ id: 'u1' });
  findOneMock.mockResolvedValueOnce(null); // check existing
  findTypeMock.mockResolvedValue({ id: 't1' });
  findCountryMock.mockResolvedValue({ id: 'c1' });
  createMock.mockResolvedValue(passportInstance);
  findOneMock.mockResolvedValueOnce(passportInstance); // for getByUser after create

  const data = { document_type: 'CIVIL', country: 'RU', series: '45' };
  const res = await service.createForUser('u1', data, 'admin');
  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'u1', document_type_id: 't1', country_id: 'c1' })
  );
  expect(res).toBe(passportInstance);
});

test('removeByUser destroys passport', async () => {
  findOneMock.mockResolvedValue(passportInstance);
  await service.removeByUser('u1');
  expect(destroyMock).toHaveBeenCalled();
});
