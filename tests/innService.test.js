import { expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();

const innInstance = { update: updateMock };

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Inn: {
    findOne: findOneMock,
    create: createMock,
  },
}));
jest.unstable_mockModule('../src/services/taxationService.js', () => ({
  __esModule: true,
  default: { removeByUser: jest.fn() },
}));

const { default: service } = await import('../src/services/innService.js');

test('create throws when duplicate exists', async () => {
  findOneMock.mockResolvedValueOnce({ id: 'd' });
  await expect(service.create('u1', '123', 'a')).rejects.toThrow('inn_exists');
});

test('update throws when duplicate exists', async () => {
  findOneMock.mockResolvedValueOnce(innInstance); // first call for user record
  findOneMock.mockResolvedValueOnce({ id: 'other' }); // second call duplicate
  await expect(service.update('u1', '123', 'a')).rejects.toThrow('inn_exists');
});
