import { beforeEach, expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const destroyMock = jest.fn();
const updateMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Vehicle: {
    findOne: findOneMock,
  },
}));

const { default: service } = await import('../src/services/vehicleService.js');

beforeEach(() => {
  findOneMock.mockReset();
  destroyMock.mockReset();
  updateMock.mockReset();
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
