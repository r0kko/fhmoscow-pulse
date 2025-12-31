import { beforeEach, expect, jest, test } from '@jest/globals';

const listMyAssignmentsMock = jest.fn();
const listMyDatesMock = jest.fn();
const confirmDayMock = jest.fn();
const sendErrorMock = jest.fn();

beforeEach(() => {
  listMyAssignmentsMock.mockReset();
  listMyDatesMock.mockReset();
  confirmDayMock.mockReset();
  sendErrorMock.mockReset();
});

jest.unstable_mockModule('../src/services/refereeAssignmentService.js', () => ({
  __esModule: true,
  default: {
    listAssignmentDatesForUser: listMyDatesMock,
    listAssignmentsForUser: listMyAssignmentsMock,
    confirmAssignmentsForDate: confirmDayMock,
  },
}));

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError: sendErrorMock,
}));

const { default: controller } =
  await import('../src/controllers/refereeAssignmentSelfController.js');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

test('listMyAssignments returns service payload', async () => {
  listMyAssignmentsMock.mockResolvedValue({ matches: [] });
  const res = mockRes();
  await controller.listMyAssignments(
    { query: { date: '2024-02-10' }, user: { id: 'u1' } },
    res
  );
  expect(listMyAssignmentsMock).toHaveBeenCalledWith('u1', '2024-02-10');
  expect(res.json).toHaveBeenCalledWith({ matches: [] });
});

test('listMyDates returns service payload', async () => {
  listMyDatesMock.mockResolvedValue({ dates: [] });
  const res = mockRes();
  await controller.listMyDates({ user: { id: 'u1' } }, res);
  expect(listMyDatesMock).toHaveBeenCalledWith('u1');
  expect(res.json).toHaveBeenCalledWith({ dates: [] });
});

test('confirmDayAssignments forwards actor', async () => {
  confirmDayMock.mockResolvedValue({ confirmed_count: 2 });
  const res = mockRes();
  await controller.confirmDayAssignments(
    { body: { date: '2024-02-10' }, user: { id: 'u1' } },
    res
  );
  expect(confirmDayMock).toHaveBeenCalledWith('2024-02-10', 'u1');
  expect(res.json).toHaveBeenCalledWith({ confirmed_count: 2 });
});

test('listMyAssignments sends errors', async () => {
  const err = new Error('boom');
  listMyAssignmentsMock.mockRejectedValue(err);
  const res = mockRes();
  await controller.listMyAssignments(
    { query: { from: '2024-02-10' }, user: { id: 'u1' } },
    res
  );
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});
