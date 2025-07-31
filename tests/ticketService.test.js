import { beforeEach, expect, jest, test } from '@jest/globals';

const findAndCountAllMock = jest.fn();
const findByPkMock = jest.fn();
const findAllMock = jest.fn();
const createMock = jest.fn();
const maxMock = jest.fn();
const updateMock = jest.fn();
const destroyMock = jest.fn();
const ticketFindOneMock = jest.fn();
const findOneTypeMock = jest.fn();
const findOneStatusMock = jest.fn();
const userFindByPkMock = jest.fn();
const sendCreatedEmailMock = jest.fn();
const sendStatusChangedEmailMock = jest.fn();

beforeEach(() => {
  findAndCountAllMock.mockReset();
  findByPkMock.mockReset();
  findAllMock.mockReset();
  createMock.mockReset();
  maxMock.mockReset();
  updateMock.mockReset();
  destroyMock.mockReset();
  ticketFindOneMock.mockReset();
  findOneTypeMock.mockReset();
  findOneStatusMock.mockReset();
  userFindByPkMock.mockReset();
  sendCreatedEmailMock.mockReset();
  sendStatusChangedEmailMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Ticket: {
    findAndCountAll: findAndCountAllMock,
    findByPk: findByPkMock,
    findOne: ticketFindOneMock,
    findAll: findAllMock,
    create: createMock,
    max: maxMock,
  },
  TicketType: { findOne: findOneTypeMock },
  TicketStatus: { findOne: findOneStatusMock },
  User: { findByPk: userFindByPkMock },
  TicketFile: {},
  File: {},
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendTicketCreatedEmail: sendCreatedEmailMock,
    sendTicketStatusChangedEmail: sendStatusChangedEmailMock,
  },
}));

const { default: service } = await import('../src/services/ticketService.js');

test('listAll passes pagination options', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await service.listAll({ page: 2, limit: 5 });
  const arg = findAndCountAllMock.mock.calls[0][0];
  expect(arg.limit).toBe(5);
  expect(arg.offset).toBe(5);
  expect(arg.include.length).toBe(4);
});

test('update throws when not found', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.update('t1', {}, 'u1')).rejects.toThrow('ticket_not_found');
});


test('getById returns ticket', async () => {
  findByPkMock.mockResolvedValue({ id: 't1' });
  const res = await service.getById('t1');
  expect(res).toEqual({ id: 't1' });
});

test('getById throws when missing', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.getById('t2')).rejects.toThrow('ticket_not_found');
});


test('listByUser returns tickets', async () => {
  findAllMock.mockResolvedValue([{ id: 't1' }]);
  const res = await service.listByUser('u1');
  expect(res).toEqual([{ id: 't1' }]);
});

test('createForUser creates ticket', async () => {
  userFindByPkMock.mockResolvedValue({ id: 'u1' });
  findOneTypeMock.mockResolvedValue({ id: 'type1' });
  findOneStatusMock.mockResolvedValue({ id: 'status1' });
  maxMock.mockResolvedValue(null);
  createMock.mockResolvedValue({ id: 't1' });
  findByPkMock.mockResolvedValue({ id: 't1' });
  const ticket = await service.createForUser('u1', { type_alias: 'A' }, 'admin');
  expect(createMock).toHaveBeenCalled();
  expect(ticket).toEqual({ id: 't1' });
  expect(sendCreatedEmailMock).toHaveBeenCalled();
});

test('updateForUser updates ticket', async () => {
  ticketFindOneMock.mockResolvedValue({
    id: 't1',
    type_id: 'type1',
    status_id: 'status1',
    description: 'd',
    update: updateMock,
  });
  findOneStatusMock.mockResolvedValue({ id: 'status2' });
  userFindByPkMock.mockResolvedValue({ id: 'u1', email: 'e' });
  findByPkMock.mockResolvedValue({ id: 't1' });
  const res = await service.updateForUser('u1', 't1', { status_alias: 'X' }, 'adm');
  expect(updateMock).toHaveBeenCalled();
  expect(res).toEqual({ id: 't1' });
  expect(sendStatusChangedEmailMock).toHaveBeenCalled();
});

test('removeForUser deletes ticket', async () => {
  ticketFindOneMock.mockResolvedValue({
    update: updateMock,
    destroy: destroyMock,
    TicketStatus: { alias: 'CREATED' },
  });
  await service.removeForUser('u1', 't1', 'adm');
  expect(updateMock).toHaveBeenCalledWith({ updated_by: 'adm' });
  expect(destroyMock).toHaveBeenCalled();
});

test('removeForUser rejects when not created', async () => {
  ticketFindOneMock.mockResolvedValue({
    update: updateMock,
    destroy: destroyMock,
    TicketStatus: { alias: 'IN_PROGRESS' },
  });
  await expect(service.removeForUser('u1', 't1')).rejects.toThrow('ticket_locked');
});

test('progressStatus moves ticket forward', async () => {
  findByPkMock
    .mockResolvedValueOnce({
      id: 't1',
      user_id: 'u1',
      TicketStatus: { alias: 'CREATED' },
    })
    .mockResolvedValueOnce({ id: 't1', TicketStatus: { alias: 'IN_PROGRESS' } });
  ticketFindOneMock.mockResolvedValue({
    id: 't1',
    user_id: 'u1',
    type_id: 'type1',
    status_id: 's1',
    update: updateMock,
  });
  findOneStatusMock.mockResolvedValue({ id: 's2' });
  userFindByPkMock.mockResolvedValue({ id: 'u1', email: 'e' });
  const res = await service.progressStatus('t1', 'admin');
  expect(updateMock).toHaveBeenCalled();
  expect(res).toEqual({ id: 't1', TicketStatus: { alias: 'IN_PROGRESS' } });
  expect(sendStatusChangedEmailMock).toHaveBeenCalled();
});



test('createForUser throws when user missing', async () => {
  userFindByPkMock.mockResolvedValue(null);
  await expect(service.createForUser('u1', { type_alias: 'A' }, 'adm')).rejects.toThrow('user_not_found');
});

test('removeForUser throws when missing', async () => {
  ticketFindOneMock.mockResolvedValue(null);
  await expect(service.removeForUser('u1', 't1')).rejects.toThrow('ticket_not_found');
});

