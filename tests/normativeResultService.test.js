import { jest, expect, test, beforeEach } from '@jest/globals';

const findAndCountAllMock = jest.fn();
const createResultMock = jest.fn();
const findTypeMock = jest.fn();
const findSeasonMock = jest.fn();
const findUserMock = jest.fn();
const findRegMock = jest.fn();
const createRegMock = jest.fn();
const findRoleMock = jest.fn();
const findResultByPkMock = jest.fn();
const sendAddEmailMock = jest.fn();
const sendUpdateEmailMock = jest.fn();
const sendRemoveEmailMock = jest.fn();
const determineZoneMock = jest.fn();

function mockAll() {
  jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  NormativeResult: {
    findAndCountAll: findAndCountAllMock,
    create: createResultMock,
    findByPk: findResultByPkMock,
  },
  NormativeType: { findByPk: findTypeMock },
  NormativeTypeZone: {},
  NormativeGroupType: {},
  NormativeGroup: {},
  NormativeZone: {},
  Ground: {},
  Training: {},
  Season: { findByPk: findSeasonMock },
  User: { findByPk: findUserMock },
  MeasurementUnit: {},
  TrainingRegistration: {
    findOne: findRegMock,
    create: createRegMock,
  },
  TrainingRole: { findOne: findRoleMock },
  }));

  jest.unstable_mockModule('../src/services/normativeTypeService.js', () => ({
  __esModule: true,
  parseResultValue: jest.fn((v) => v),
  determineZone: determineZoneMock,
  }));

  jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendNormativeResultAddedEmail: sendAddEmailMock,
    sendNormativeResultUpdatedEmail: sendUpdateEmailMock,
    sendNormativeResultRemovedEmail: sendRemoveEmailMock,
  },
  }));
}

let service;
await jest.isolateModulesAsync(async () => {
  mockAll();
  ({ default: service } = await import('../src/services/normativeResultService.js'));
});

const dataRow = {
  setDataValue(key, val) {
    this[key] = val;
  },
  id: 'r1',
  user_id: 'u1',
  season_id: 's1',
  value: 7,
  NormativeZone: { alias: 'YELLOW' },
  NormativeType: {
    NormativeGroupTypes: [{ NormativeGroup: { id: 'g1', name: 'G1' } }],
  },
};

findAndCountAllMock.mockResolvedValue({ rows: [dataRow], count: 1 });
createResultMock.mockResolvedValue({ id: 'nr1' });
findResultByPkMock.mockResolvedValue({ id: 'nr1' });
findTypeMock.mockResolvedValue({
  id: 't1',
  unit_id: 'u1',
  value_type_id: 'vt1',
  season_id: 's1',
  MeasurementUnit: {},
  NormativeTypeZone: [],
});
findSeasonMock.mockResolvedValue({ id: 's1' });
findUserMock.mockResolvedValue({ id: 'u1', sex_id: 'sx1', email: 'user@ex.com' });
findRegMock.mockResolvedValue(null);
createRegMock.mockResolvedValue({});
findRoleMock.mockResolvedValue({ id: 'role1' });

beforeEach(() => {
  sendAddEmailMock.mockClear();
  sendUpdateEmailMock.mockClear();
  sendRemoveEmailMock.mockClear();
});

test('listAll filters by user and maps zone and group', async () => {
  const { rows, count } = await service.listAll({ user_id: 'u1' });
  expect(count).toBe(1);
  expect(findAndCountAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { user_id: 'u1' },
      include: expect.any(Array),
    })
  );
  expect(rows[0].zone.alias).toBe('YELLOW');
  expect(rows[0].group.name).toBe('G1');
});

test('create ensures registration', async () => {
  await service.create({
    user_id: 'u1',
    season_id: 's1',
    training_id: 'tr1',
    type_id: 't1',
    value: 5,
  });
  expect(findRegMock).toHaveBeenCalledWith({
    where: { training_id: 'tr1', user_id: 'u1' },
    paranoid: false,
  });
  expect(createRegMock).toHaveBeenCalledWith(
    expect.objectContaining({ training_id: 'tr1', user_id: 'u1', present: true })
  );
  expect(createResultMock).toHaveBeenCalled();
  expect(sendAddEmailMock).toHaveBeenCalled();
});

test('create passes user sex to zone determination', async () => {
  await service.create({
    user_id: 'u1',
    season_id: 's1',
    training_id: 'tr1',
    type_id: 't1',
    value: 5,
  });
  expect(determineZoneMock).toHaveBeenCalledWith(expect.any(Object), 5, 'sx1');
});

test('remove fetches user when email missing', async () => {
  const updateMock = jest.fn();
  const destroyMock = jest.fn();
  findResultByPkMock.mockResolvedValueOnce({
    id: 'nr1',
    user_id: 'u1',
    update: updateMock,
    destroy: destroyMock,
    User: { id: 'u1' },
  });
  findUserMock.mockResolvedValueOnce({ id: 'u1', email: 'test@ex.com' });

  await service.remove('nr1', 'adm');

  expect(updateMock).toHaveBeenCalledWith({ updated_by: 'adm' });
  expect(destroyMock).toHaveBeenCalled();
  expect(findUserMock).toHaveBeenCalledWith('u1');
  expect(sendRemoveEmailMock).toHaveBeenCalled();
});

test('create does not send email without user email', async () => {
  findUserMock.mockResolvedValueOnce({ id: 'u1', sex_id: 'sx1' });
  await service.create({
    user_id: 'u1',
    season_id: 's1',
    training_id: 'tr1',
    type_id: 't1',
    value: 5,
  });
  expect(sendAddEmailMock).not.toHaveBeenCalled();
});

test('create fails when both online and retake', async () => {
  await expect(
    service.create({
      user_id: 'u1',
      season_id: 's1',
      type_id: 't1',
      value: 5,
      online: true,
      retake: true,
    })
  ).rejects.toThrow('online_retake_conflict');
});
