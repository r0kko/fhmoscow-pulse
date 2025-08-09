import { expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../src/services/courseService.js', () => ({
  __esModule: true,
  default: { getUserWithCourse: jest.fn() },
}));

jest.unstable_mockModule('../src/mappers/courseMapper.js', () => ({
  __esModule: true,
  default: { toPublic: jest.fn((c) => c) },
}));

const { default: controller } = await import(
  '../src/controllers/courseController.js'
);
const service = await import('../src/services/courseService.js');

test('me returns course when assigned', async () => {
  service.default.getUserWithCourse.mockResolvedValue({ course: { id: 'c1' } });
  const req = { user: { id: 'u1' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
  expect(res.json).toHaveBeenCalledWith({ course: { id: 'c1' } });
});

test('me returns 404 when no course', async () => {
  service.default.getUserWithCourse.mockResolvedValue({ course: null });
  const req = { user: { id: 'u1' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: 'course_not_found' });
});
