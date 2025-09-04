import { expect, jest, test } from '@jest/globals';

// Import the controller directly
const { default: controller } = await import(
  '../src/controllers/groundSelfController.js'
);

test('available returns 403 when staff has no clubs/teams', async () => {
  const req = {
    access: { isAdmin: false, allowedClubIds: [], allowedTeamIds: [] },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  await controller.available(req, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith({ error: 'Доступ запрещён' });
});

test('available returns empty groups for admin without scope', async () => {
  const req = {
    access: { isAdmin: true, allowedClubIds: [], allowedTeamIds: [] },
  };
  const res = {
    json: jest.fn(),
  };
  await controller.available(req, res);
  expect(res.json).toHaveBeenCalledWith({ groups: [] });
});
