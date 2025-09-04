import { beforeEach, expect, jest, test, describe } from '@jest/globals';

const createMock = jest.fn();
const updateMock = jest.fn();

jest.unstable_mockModule('../src/models/jobLog.js', () => ({
  __esModule: true,
  default: { create: createMock, update: updateMock },
}));

const svc = await import('../src/services/jobLogService.js');

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
});

describe('createJobRun', () => {
  test('returns id on success', async () => {
    createMock.mockResolvedValue({ id: 'job-1' });
    const id = await svc.createJobRun('syncAll', 'start');
    expect(id).toBe('job-1');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'syncAll', status: 'START' })
    );
  });

  test('returns null on failure', async () => {
    createMock.mockRejectedValue(new Error('nope'));
    const id = await svc.createJobRun('syncAll');
    expect(id).toBeNull();
  });
});

describe('finishJobRun', () => {
  test('no-op when id falsy', async () => {
    await svc.finishJobRun(null);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('updates status, finished_at, duration and message/error', async () => {
    await svc.finishJobRun('job-1', {
      status: 'FAIL',
      durationMs: 123,
      message: 'oops',
      error: new Error('boom'),
    });
    expect(updateMock).toHaveBeenCalled();
    const [fields, where] = updateMock.mock.calls[0];
    expect(where).toEqual({ where: { id: 'job-1' } });
    expect(fields.status).toBe('FAIL');
    expect(typeof fields.finished_at).toBe('object');
    expect(fields.duration_ms).toBe(123);
    expect(fields.message).toBe('oops');
    expect(fields.error_message).toContain('boom');
  });
});

describe('appendJobRun', () => {
  test('no-op when id falsy', async () => {
    await svc.appendJobRun('');
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('updates status and message', async () => {
    await svc.appendJobRun('job-x', { status: 'INFO', message: 'hello' });
    expect(updateMock).toHaveBeenCalledWith(
      { status: 'INFO', message: 'hello' },
      { where: { id: 'job-x' } }
    );
  });
});
