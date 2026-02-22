import { beforeEach, expect, jest, test } from '@jest/globals';

const addRoleMock = jest.fn();
const removeRoleMock = jest.fn();
const getRolesMock = jest.fn();

const userRoleFindMock = jest.fn();
const userRoleRestoreMock = jest.fn();

const createMock = jest.fn();
const findAndCountAllMock = jest.fn();
const findByPkMock = jest.fn();
const findOneMock = jest.fn();
const scopedFindByPkMock = jest.fn();
const userScopeMock = jest.fn(() => ({ findByPk: scopedFindByPkMock }));
const updateMock = jest.fn();
const user = {
  addRole: addRoleMock,
  removeRole: removeRoleMock,
  update: updateMock,
  getRoles: getRolesMock,
};
const findRoleMock = jest.fn();
const statusFindMock = jest.fn();
const sexFindMock = jest.fn();

beforeEach(() => {
  addRoleMock.mockReset();
  removeRoleMock.mockReset();
  getRolesMock.mockReset();
  userRoleFindMock.mockReset();
  userRoleRestoreMock.mockReset();
  createMock.mockReset();
  findAndCountAllMock.mockReset();
  findByPkMock.mockReset();
  findOneMock.mockReset();
  scopedFindByPkMock.mockReset();
  userScopeMock.mockReset().mockReturnValue({ findByPk: scopedFindByPkMock });
  updateMock.mockReset();
  findRoleMock.mockReset();
  statusFindMock.mockReset();
  sexFindMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: {
    create: createMock,
    findByPk: findByPkMock,
    findOne: findOneMock,
    findAndCountAll: findAndCountAllMock,
    scope: userScopeMock,
  },
  Role: { findOne: findRoleMock },
  UserRole: { findOne: userRoleFindMock },
  UserStatus: { findOne: statusFindMock },
  Sex: { findByPk: sexFindMock },
  Course: {},
  UserCourse: {},
}));

const { default: service } = await import('../src/services/userService.js');

test('assignRole adds role to user', async () => {
  findByPkMock.mockResolvedValue(user);
  findRoleMock.mockResolvedValue({ id: 1, alias: 'ADMIN' });
  getRolesMock.mockResolvedValue([]);
  userRoleFindMock.mockResolvedValue(null);
  await service.assignRole('1', 'ADMIN', 'a1');
  expect(addRoleMock).toHaveBeenCalled();
});

test('assignRole restores removed role', async () => {
  findByPkMock.mockResolvedValue(user);
  findRoleMock.mockResolvedValue({ id: 2, alias: 'ADMIN' });
  getRolesMock.mockResolvedValue([]);
  addRoleMock.mockClear();
  userRoleRestoreMock.mockClear();
  const updateExistingMock = jest.fn();
  userRoleFindMock.mockResolvedValue({
    deletedAt: new Date(),
    restore: userRoleRestoreMock,
    update: updateExistingMock,
  });
  await service.assignRole('1', 'ADMIN', 'a1');
  expect(userRoleRestoreMock).toHaveBeenCalled();
  expect(updateExistingMock).toHaveBeenCalledWith({ updated_by: 'a1' });
  expect(addRoleMock).not.toHaveBeenCalled();
});

test('assignRole replaces existing FHMO position', async () => {
  findByPkMock.mockResolvedValue(user);
  findRoleMock.mockResolvedValue({
    id: 3,
    alias: 'FHMO_ADMINISTRATION_PRESIDENT',
  });
  const linkUpdateMock = jest.fn();
  userRoleFindMock.mockResolvedValue(null);
  userRoleFindMock.mockResolvedValueOnce({ update: linkUpdateMock });
  userRoleFindMock.mockResolvedValueOnce(null);
  getRolesMock.mockResolvedValue([{ id: 10, alias: 'FHMO_MEDIA_SMM_MANAGER' }]);
  await service.assignRole('1', 'FHMO_ADMINISTRATION_PRESIDENT', 'manager');
  expect(linkUpdateMock).toHaveBeenCalledWith({ updated_by: 'manager' });
  expect(removeRoleMock).toHaveBeenCalledWith({
    id: 10,
    alias: 'FHMO_MEDIA_SMM_MANAGER',
  });
  expect(addRoleMock).toHaveBeenCalledWith(
    { id: 3, alias: 'FHMO_ADMINISTRATION_PRESIDENT' },
    { through: { created_by: 'manager', updated_by: 'manager' } }
  );
});

test('removeRole removes role from user', async () => {
  findByPkMock.mockResolvedValue(user);
  findRoleMock.mockResolvedValue({});
  const linkUpdateMock = jest.fn();
  userRoleFindMock.mockResolvedValueOnce({ update: linkUpdateMock });
  await service.removeRole('1', 'ADMIN', 'a1');
  expect(linkUpdateMock).toHaveBeenCalledWith({ updated_by: 'a1' });
  expect(removeRoleMock).toHaveBeenCalled();
});

test('listUsers calls model findAndCountAll', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  const result = await service.listUsers({});
  expect(result).toEqual({ rows: [], count: 0 });
  expect(findAndCountAllMock).toHaveBeenCalled();
});

test('listUsers clamps excessive limit to max cap', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await service.listUsers({ limit: 1000 });
  expect(findAndCountAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      limit: 100,
      offset: 0,
    })
  );
});

test('listUsers adds stable tie-breaker by id', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await service.listUsers({ sort: 'last_name', order: 'asc' });
  expect(findAndCountAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      order: [
        ['last_name', 'ASC'],
        ['id', 'ASC'],
      ],
    })
  );
});

test('listUsersAll iterates over pages and returns full list', async () => {
  findAndCountAllMock
    .mockResolvedValueOnce({
      rows: [{ id: 'u1' }, { id: 'u2' }],
      count: 3,
    })
    .mockResolvedValueOnce({
      rows: [{ id: 'u3' }],
      count: 3,
    });

  const res = await service.listUsersAll({ role: ['REFEREE'], batchLimit: 2 });

  expect(res).toEqual({
    rows: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }],
    count: 3,
  });
  expect(findAndCountAllMock).toHaveBeenCalledTimes(2);
  expect(findAndCountAllMock.mock.calls[0][0]).toEqual(
    expect.objectContaining({ limit: 2, offset: 0 })
  );
  expect(findAndCountAllMock.mock.calls[1][0]).toEqual(
    expect.objectContaining({ limit: 2, offset: 2 })
  );
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

test('listUsers applies role filter', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await service.listUsers({ role: ['ADMIN', 'REFEREE'] });
  expect(findAndCountAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.arrayContaining([
        expect.objectContaining({
          model: expect.anything(),
          where: { alias: ['ADMIN', 'REFEREE'] },
          required: true,
          through: { attributes: [] },
        }),
      ]),
      distinct: true,
      subQuery: false,
    })
  );
});

test('listUsers applies NO_ROLE filter with NOT EXISTS', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await service.listUsers({ role: 'NO_ROLE' });
  expect(findAndCountAllMock).toHaveBeenCalled();
  const args = findAndCountAllMock.mock.calls[0][0];
  // include contains Role with required: false
  expect(args.include).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        model: expect.anything(),
        required: false,
        through: { attributes: [] },
      }),
    ])
  );
  // where contains a NOT EXISTS literal against user_roles
  const symKeys = Object.getOwnPropertySymbols(args.where);
  const andSym = symKeys.find((s) => s.toString().includes('and'));
  expect(andSym).toBeDefined();
  const andArr = args.where[andSym];
  expect(Array.isArray(andArr)).toBe(true);
  expect(andArr).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        val: expect.stringContaining('NOT EXISTS (SELECT 1 FROM "user_roles"'),
      }),
    ])
  );
  // pagination options include distinct/subQuery for stable results
  expect(args.distinct).toBe(true);
  expect(args.subQuery).toBe(false);
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
  statusFindMock.mockResolvedValueOnce(active); // ACTIVE
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
    password: 'Passw0rd',
    sex_id: 's1',
  };
  sexFindMock.mockResolvedValueOnce({ id: 's1' });
  const res = await service.createUser(data);
  expect(createMock).toHaveBeenCalledWith({
    ...data,
    status_id: active.id,
    created_by: null,
    updated_by: null,
  });
  expect(res).toBe(user);
  expect(findOneMock).toHaveBeenCalledTimes(3);
});

test('createUser normalizes phone/email and trims names', async () => {
  createMock.mockResolvedValue(user);
  statusFindMock.mockResolvedValueOnce({ id: 'a1' });
  sexFindMock.mockResolvedValueOnce({ id: 's1' });
  findOneMock.mockResolvedValueOnce(null);
  findOneMock.mockResolvedValueOnce(null);
  findOneMock.mockResolvedValueOnce(null);

  await service.createUser({
    first_name: '  Ivan  ',
    last_name: '  Petrov ',
    patronymic: '  ',
    birth_date: ' 2001-02-03 ',
    phone: '8 (999) 111-22-33',
    email: ' TEST@EXAMPLE.COM ',
    password: 'Passw0rd',
    sex_id: 's1',
  });

  expect(findOneMock).toHaveBeenNthCalledWith(1, {
    where: { phone: '79991112233' },
  });
  expect(findOneMock).toHaveBeenNthCalledWith(2, {
    where: { email: 'test@example.com' },
  });
  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({
      first_name: 'Ivan',
      last_name: 'Petrov',
      patronymic: '',
      birth_date: '2001-02-03',
      phone: '79991112233',
      email: 'test@example.com',
    })
  );
});

test('createUser throws if phone exists', async () => {
  statusFindMock.mockResolvedValueOnce({ id: 'a1' });
  findOneMock.mockResolvedValueOnce({}); // phone
  findOneMock.mockResolvedValueOnce(null); // email
  findOneMock.mockResolvedValueOnce(null); // name
  sexFindMock.mockResolvedValueOnce({ id: 's1' });
  await expect(
    service.createUser({
      phone: '123',
      email: 'e',
      last_name: 'L',
      first_name: 'F',
      patronymic: 'P',
      birth_date: '2000-01-01',
      password: 'Passw0rd',
      sex_id: 's1',
    })
  ).rejects.toThrow('phone_exists');
});

test('createUser throws if email exists', async () => {
  statusFindMock.mockResolvedValueOnce({ id: 'a1' });
  findOneMock.mockResolvedValueOnce(null); // phone
  findOneMock.mockResolvedValueOnce({}); // email
  findOneMock.mockResolvedValueOnce(null); // name
  sexFindMock.mockResolvedValueOnce({ id: 's1' });
  await expect(
    service.createUser({
      phone: '123',
      email: 'e',
      last_name: 'L',
      first_name: 'F',
      patronymic: 'P',
      birth_date: '2000-01-01',
      password: 'Passw0rd',
      sex_id: 's1',
    })
  ).rejects.toThrow('email_exists');
});

test('createUser throws if user exists by name', async () => {
  statusFindMock.mockResolvedValueOnce({ id: 'a1' });
  findOneMock.mockResolvedValueOnce(null); // phone
  findOneMock.mockResolvedValueOnce(null); // email
  findOneMock.mockResolvedValueOnce({}); // name
  sexFindMock.mockResolvedValueOnce({ id: 's1' });
  await expect(
    service.createUser({
      phone: '123',
      email: 'e',
      last_name: 'L',
      first_name: 'F',
      patronymic: 'P',
      birth_date: '2000-01-01',
      password: 'Passw0rd',
      sex_id: 's1',
    })
  ).rejects.toThrow('user_exists');
});

test('updateUser updates found user', async () => {
  findByPkMock.mockResolvedValue(user);
  updateMock.mockResolvedValue(user);
  const res = await service.updateUser('1', {
    first_name: ' B ',
    phone: '8 (999) 222-33-44',
    email: ' USER@EXAMPLE.COM ',
  });
  expect(updateMock).toHaveBeenCalledWith({
    first_name: 'B',
    phone: '79992223344',
    email: 'user@example.com',
    updated_by: null,
  });
  expect(res).toBe(user);
});

test('updateUser throws when missing', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.updateUser('1', {})).rejects.toThrow('user_not_found');
});

test('createUser rejects birth date before 1945', async () => {
  await expect(
    service.createUser({
      phone: '123',
      email: 'e',
      last_name: 'L',
      first_name: 'F',
      patronymic: 'P',
      birth_date: '1940-01-01',
      password: 'p',
    })
  ).rejects.toThrow('invalid_birth_date');
});

test('createUser rejects future birth date', async () => {
  const nextYear = String(new Date().getFullYear() + 1);
  await expect(
    service.createUser({
      phone: '123',
      email: 'e',
      last_name: 'L',
      first_name: 'F',
      patronymic: 'P',
      birth_date: `${nextYear}-01-01`,
      password: 'Passw0rd',
      sex_id: 's1',
    })
  ).rejects.toThrow('invalid_birth_date');
});

test('createUser throws status_not_found when ACTIVE status is missing', async () => {
  statusFindMock.mockResolvedValueOnce(null);
  sexFindMock.mockResolvedValueOnce({ id: 's1' });
  await expect(
    service.createUser({
      phone: '79991112233',
      email: 'x@example.com',
      last_name: 'L',
      first_name: 'F',
      patronymic: 'P',
      birth_date: '2000-01-01',
      password: 'Passw0rd',
      sex_id: 's1',
    })
  ).rejects.toThrow('status_not_found');
});

test('createUser maps unique DB errors to domain codes', async () => {
  statusFindMock.mockResolvedValueOnce({ id: 'a1' });
  sexFindMock.mockResolvedValueOnce({ id: 's1' });
  findOneMock.mockResolvedValueOnce(null);
  findOneMock.mockResolvedValueOnce(null);
  findOneMock.mockResolvedValueOnce(null);
  createMock.mockRejectedValueOnce({
    name: 'SequelizeUniqueConstraintError',
    fields: { phone: '79991112233' },
    errors: [{ path: 'phone' }],
  });

  await expect(
    service.createUser({
      phone: '79991112233',
      email: 'x@example.com',
      last_name: 'L',
      first_name: 'F',
      patronymic: 'P',
      birth_date: '2000-01-01',
      password: 'Passw0rd',
      sex_id: 's1',
    })
  ).rejects.toThrow('phone_exists');
});

test('updateUser maps unique DB errors to domain codes', async () => {
  findByPkMock.mockResolvedValue({
    ...user,
    update: jest.fn().mockRejectedValue({
      name: 'SequelizeUniqueConstraintError',
      fields: { email: 'dup@example.com' },
      errors: [{ path: 'email' }],
    }),
  });

  await expect(
    service.updateUser('1', { email: 'dup@example.com' }, 'admin')
  ).rejects.toThrow('email_exists');
});

test('setTemporaryPassword updates password and change-required flag', async () => {
  const saveMock = jest.fn().mockResolvedValue(undefined);
  const scopedUser = {
    password: '',
    password_change_required: false,
    updated_by: null,
    save: saveMock,
  };
  scopedFindByPkMock.mockResolvedValue(scopedUser);

  const result = await service.setTemporaryPassword('u1', 'Passw0rd', 'admin');

  expect(userScopeMock).toHaveBeenCalledWith('withPassword');
  expect(scopedFindByPkMock).toHaveBeenCalledWith('u1');
  expect(scopedUser.password).toBe('Passw0rd');
  expect(scopedUser.password_change_required).toBe(true);
  expect(scopedUser.updated_by).toBe('admin');
  expect(saveMock).toHaveBeenCalled();
  expect(result).toBe(scopedUser);
});
