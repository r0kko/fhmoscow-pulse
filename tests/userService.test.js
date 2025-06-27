import { expect, jest, test } from '@jest/globals';

const addRoleMock = jest.fn();
const removeRoleMock = jest.fn();

const createMock = jest.fn();
const findAndCountAllMock = jest.fn();
const findByPkMock = jest.fn();
const findOneMock = jest.fn();
const updateMock = jest.fn();
const user = { addRole: addRoleMock, removeRole: removeRoleMock, update: updateMock };
const findRoleMock = jest.fn();
const statusFindMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: {
    create: createMock,
    findByPk: findByPkMock,
    findOne: findOneMock,
    findAndCountAll: findAndCountAllMock,
  },
  Role: { findOne: findRoleMock },
  UserStatus: { findOne: statusFindMock },
}));

const { default: service } = await import('../src/services/userService.js');

test('assignRole adds role to user', async () => {
  findByPkMock.mockResolvedValue(user);
  findRoleMock.mockResolvedValue({});
  await service.assignRole('1', 'ADMIN');
  expect(addRoleMock).toHaveBeenCalled();
});

test('removeRole removes role from user', async () => {
  findByPkMock.mockResolvedValue(user);
  findRoleMock.mockResolvedValue({});
  await service.removeRole('1', 'ADMIN');
  expect(removeRoleMock).toHaveBeenCalled();
});

test('listUsers calls model findAndCountAll', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  const result = await service.listUsers({});
  expect(result).toEqual({ rows: [], count: 0 });
  expect(findAndCountAllMock).toHaveBeenCalled();
});

test('listUsers applies status filter', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await service.listUsers({ status: 'ACTIVE' });
  expect(findAndCountAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.arrayContaining([
        expect.objectContaining({
          model: expect.anything(),
          where: { alias: 'ACTIVE' },
          required: true,
        }),
      ]),
    })
  );
});

test('getUser throws on missing user', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.getUser('1')).rejects.toThrow('user_not_found');
});

test('getUser returns user', async () => {
  findByPkMock.mockResolvedValue(user);
  const res = await service.getUser('1');
  expect(res).toBe(user);
  expect(findByPkMock).toHaveBeenCalledWith('1', expect.any(Object));
});

test('createUser passes data to model', async () => {
  createMock.mockResolvedValue(user);
  const active = { id: 'a1' };
  const unconfirmed = { id: 'u1' };
  statusFindMock.mockResolvedValueOnce(active); // ACTIVE
  statusFindMock.mockResolvedValueOnce(unconfirmed); // EMAIL_UNCONFIRMED
  findOneMock.mockResolvedValueOnce(null); // phone
  findOneMock.mockResolvedValueOnce(null); // email
  findOneMock.mockResolvedValueOnce(null); // name + birthdate
  const data = {
    first_name: 'A',
    last_name: 'B',
    patronymic: 'C',
    birth_date: '2000-01-01',
    phone: '123',
    email: 'test@example.com',
    password: 'pass',
  };
  const res = await service.createUser(data);
  expect(createMock).toHaveBeenCalledWith({ ...data, status_id: unconfirmed.id });
  expect(res).toBe(user);
  expect(findOneMock).toHaveBeenCalledTimes(3);
});

test('createUser throws if phone exists', async () => {
  statusFindMock.mockResolvedValueOnce({ id: 'a1' });
  statusFindMock.mockResolvedValueOnce(null);
  findOneMock.mockResolvedValueOnce({}); // phone
  findOneMock.mockResolvedValueOnce(null); // email
  findOneMock.mockResolvedValueOnce(null); // name
  await expect(
    service.createUser({ phone: '123', email: 'e', last_name: 'L', first_name: 'F', patronymic: 'P', birth_date: '2000-01-01', password: 'p' })
  ).rejects.toThrow('phone_exists');
});

test('createUser throws if email exists', async () => {
  statusFindMock.mockResolvedValueOnce({ id: 'a1' });
  statusFindMock.mockResolvedValueOnce(null);
  findOneMock.mockResolvedValueOnce(null); // phone
  findOneMock.mockResolvedValueOnce({}); // email
  findOneMock.mockResolvedValueOnce(null); // name
  await expect(
    service.createUser({ phone: '123', email: 'e', last_name: 'L', first_name: 'F', patronymic: 'P', birth_date: '2000-01-01', password: 'p' })
  ).rejects.toThrow('email_exists');
});

test('createUser throws if user exists by name', async () => {
  statusFindMock.mockResolvedValueOnce({ id: 'a1' });
  statusFindMock.mockResolvedValueOnce(null);
  findOneMock.mockResolvedValueOnce(null); // phone
  findOneMock.mockResolvedValueOnce(null); // email
  findOneMock.mockResolvedValueOnce({}); // name
  await expect(
    service.createUser({ phone: '123', email: 'e', last_name: 'L', first_name: 'F', patronymic: 'P', birth_date: '2000-01-01', password: 'p' })
  ).rejects.toThrow('user_exists');
});

test('updateUser updates found user', async () => {
  findByPkMock.mockResolvedValue(user);
  updateMock.mockResolvedValue(user);
  const res = await service.updateUser('1', { first_name: 'B' });
  expect(updateMock).toHaveBeenCalledWith({ first_name: 'B' });
  expect(res).toBe(user);
});

test('updateUser throws when missing', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.updateUser('1', {})).rejects.toThrow('user_not_found');
});
