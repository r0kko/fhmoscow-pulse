import { beforeEach, expect, jest, test } from '@jest/globals';

const listMatchesMock = jest.fn();
const listRoleGroupsMock = jest.fn();
const listRefereesMock = jest.fn();
const updateMatchMock = jest.fn();
const publishMatchMock = jest.fn();
const publishDayMock = jest.fn();
const sendErrorMock = jest.fn();

beforeEach(() => {
  listMatchesMock.mockReset();
  listRoleGroupsMock.mockReset();
  listRefereesMock.mockReset();
  updateMatchMock.mockReset();
  publishMatchMock.mockReset();
  publishDayMock.mockReset();
  sendErrorMock.mockReset();
});

jest.unstable_mockModule('../src/services/refereeAssignmentService.js', () => ({
  __esModule: true,
  default: {
    listRoleGroups: listRoleGroupsMock,
    listMatchesByDate: listMatchesMock,
    listRefereesByDate: listRefereesMock,
    updateMatchReferees: updateMatchMock,
    publishMatchReferees: publishMatchMock,
    publishAssignmentsForDate: publishDayMock,
  },
}));

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError: sendErrorMock,
}));

const { default: controller } = await import(
  '../src/controllers/refereeAssignmentAdminController.js'
);

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

test('listMatches returns service payload', async () => {
  listMatchesMock.mockResolvedValue({ matches: [] });
  const res = mockRes();
  await controller.listMatches({ query: { date: '2024-02-10' } }, res);
  expect(listMatchesMock).toHaveBeenCalledWith('2024-02-10');
  expect(res.json).toHaveBeenCalledWith({ matches: [] });
});

test('listRoleGroups returns service payload', async () => {
  listRoleGroupsMock.mockResolvedValue([
    { id: 'rg1', name: 'Группа', RefereeRoles: [] },
  ]);
  const res = mockRes();
  await controller.listRoleGroups({}, res);
  expect(listRoleGroupsMock).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({
    groups: [{ id: 'rg1', name: 'Группа', roles: [] }],
  });
});

test('listReferees passes filters', async () => {
  listRefereesMock.mockResolvedValue({ referees: [] });
  const res = mockRes();
  await controller.listReferees(
    { query: { date: '2024-02-10', role_group_id: 'g1', search: 'Иванов' } },
    res
  );
  expect(listRefereesMock).toHaveBeenCalledWith({
    dateKey: '2024-02-10',
    roleGroupId: 'g1',
    search: 'Иванов',
    limit: undefined,
  });
  expect(res.json).toHaveBeenCalledWith({ referees: [] });
});

test('updateMatchReferees forwards payload', async () => {
  updateMatchMock.mockResolvedValue({
    assignments: [{ id: 'a1' }],
    draft_clear_group_ids: [],
  });
  const res = mockRes();
  await controller.updateMatchReferees(
    {
      params: { id: 'm1' },
      user: { id: 'admin' },
      body: {
        assignments: [{ role_id: 'r1', user_id: 'u1' }],
        role_group_id: 'g1',
      },
    },
    res
  );
  expect(updateMatchMock).toHaveBeenCalledWith(
    'm1',
    [{ role_id: 'r1', user_id: 'u1' }],
    'admin',
    { roleGroupId: 'g1', clearPublished: false }
  );
  expect(res.json).toHaveBeenCalledWith({
    assignments: [{ id: 'a1' }],
    draft_clear_group_ids: [],
  });
});

test('publishMatchReferees forwards actor', async () => {
  publishMatchMock.mockResolvedValue([{ id: 'a1' }]);
  const res = mockRes();
  await controller.publishMatchReferees(
    { params: { id: 'm1' }, user: { id: 'admin' } },
    res
  );
  expect(publishMatchMock).toHaveBeenCalledWith('m1', 'admin');
  expect(res.json).toHaveBeenCalledWith({ assignments: [{ id: 'a1' }] });
});

test('publishDay forwards payload', async () => {
  publishDayMock.mockResolvedValue({ published_count: 1 });
  const res = mockRes();
  await controller.publishDay(
    {
      user: { id: 'admin' },
      body: { date: '2024-02-10', role_group_id: 'rg1' },
    },
    res
  );
  expect(publishDayMock).toHaveBeenCalledWith('2024-02-10', 'admin', {
    roleGroupIds: ['rg1'],
  });
  expect(res.json).toHaveBeenCalledWith({ published_count: 1 });
});

test('listMatches sends errors', async () => {
  const err = new Error('boom');
  listMatchesMock.mockRejectedValue(err);
  const res = mockRes();
  await controller.listMatches({ query: { date: '2024-02-10' } }, res);
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});
