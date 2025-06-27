import { expect, jest, test } from '@jest/globals';
import requireActive from '../src/middlewares/requireActive.js';

test('allows active user', async () => {
  const req = { user: { getUserStatus: jest.fn().mockResolvedValue({ alias: 'ACTIVE' }) } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await requireActive(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('blocks incomplete registration', async () => {
  const req = { user: { getUserStatus: jest.fn().mockResolvedValue({ alias: 'REGISTRATION_STEP_1' }) } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await requireActive(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith({ error: 'registration_incomplete', step: 1 });
  expect(next).not.toHaveBeenCalled();
});

test('blocks awaiting confirmation', async () => {
  const req = { user: { getUserStatus: jest.fn().mockResolvedValue({ alias: 'AWAITING_CONFIRMATION' }) } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await requireActive(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith({ error: 'awaiting_confirmation' });
});
