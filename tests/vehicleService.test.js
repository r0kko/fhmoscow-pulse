import { beforeEach, expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const findAllMock = jest.fn();
const countMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();
const destroyMock = jest.fn();
const vehicleUpdateMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Vehicle: {
    findOne: findOneMock,
    findAll: findAllMock,
    count: countMock,
    create: createMock,
    update: updateMock,
  },
}));

const { default: service } = await import('../src/services/vehicleService.js');

beforeEach(() => {
  findOneMock.mockReset();
  findAllMock.mockReset();
  countMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  destroyMock.mockReset();
  vehicleUpdateMock.mockReset();
});

test('removing active vehicle activates another if available', async () => {
  const active = { is_active: true, destroy: destroyMock };
  const replacement = { update: updateMock };
  findOneMock
    .mockResolvedValueOnce(active)
    .mockResolvedValueOnce(replacement);
  await service.removeForUser('u1', 'v1', 'actor');
  expect(destroyMock).toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith({ is_active: true, updated_by: 'actor' });
});

test('removing inactive vehicle leaves active untouched', async () => {
  const inactive = { is_active: false, destroy: destroyMock };
  findOneMock.mockResolvedValueOnce(inactive);
  await service.removeForUser('u1', 'v1', 'actor');
  expect(destroyMock).toHaveBeenCalled();
  expect(updateMock).not.toHaveBeenCalled();
});

test('removeForUser throws when vehicle not found', async () => {
  findOneMock.mockResolvedValueOnce(null);
  await expect(service.removeForUser('u1', 'v1', 'actor')).rejects.toThrow(
    'vehicle_not_found'
  );
});

test('listForUser delegates to model', async () => {
  findAllMock.mockResolvedValue([]);
  await service.listForUser('user');
  expect(findAllMock).toHaveBeenCalledWith({
    where: { user_id: 'user' },
    order: [['created_at', 'ASC']],
  });
});

test('createForUser enforces limit and sets active on first', async () => {
  countMock.mockResolvedValueOnce(0);
  createMock.mockResolvedValue({ id: 'v1' });
  const data = { plate: '123' };
  await service.createForUser('u1', data, 'actor');
  expect(createMock).toHaveBeenCalledWith({
    user_id: 'u1',
    plate: '123',
    created_by: 'actor',
    updated_by: 'actor',
    is_active: true,
  });
  countMock.mockResolvedValueOnce(3);
  await expect(
    service.createForUser('u1', data, 'actor')
  ).rejects.toThrow('vehicle_limit');
});

test('updateForUser toggles active flag', async () => {
  const vehicle = { update: vehicleUpdateMock };
  findOneMock.mockResolvedValueOnce(vehicle);
  await service.updateForUser('u1', 'v1', { is_active: true }, 'actor');
  expect(updateMock).toHaveBeenCalledWith(
    { is_active: false, updated_by: 'actor' },
    { where: { user_id: 'u1' } }
  );
  expect(vehicleUpdateMock).toHaveBeenCalledWith({
    is_active: true,
    updated_by: 'actor',
  });
});

test('updateForUser throws when vehicle missing', async () => {
  findOneMock.mockResolvedValueOnce(null);
  await expect(
    service.updateForUser('u1', 'v1', {}, 'actor')
  ).rejects.toThrow('vehicle_not_found');
});
