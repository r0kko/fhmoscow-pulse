import { expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();

const snilsInstance = { update: updateMock };

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Snils: {
    findOne: findOneMock,
    create: createMock,
  },
}));

const { default: service } = await import('../src/services/snilsService.js');

test('create throws when duplicate exists', async () => {
  findOneMock.mockResolvedValueOnce({ id: 'd' });
  await expect(service.create('u1', '123', 'a')).rejects.toThrow('snils_exists');
});

test('update throws when duplicate exists', async () => {
  findOneMock.mockResolvedValueOnce(snilsInstance); // user record
  findOneMock.mockResolvedValueOnce({ id: 'other' }); // duplicate
  await expect(service.update('u1', '123', 'a')).rejects.toThrow('snils_exists');
});
