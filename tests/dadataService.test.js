/* global fetch, process, global */
import { expect, jest, test } from '@jest/globals';

const warnMock = jest.fn();

global.fetch = jest.fn();

jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: { warn: warnMock },
}));

process.env.DADATA_TOKEN = 'token';

const { suggestFio, cleanFio } = await import('../src/services/dadataService.js');

test('suggestFio returns array from API', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ suggestions: [{ value: 'x' }] }),
  });
  const res = await suggestFio('x', ['SURNAME']);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/suggest/fio'),
    expect.objectContaining({
      body: JSON.stringify({ query: 'x', parts: ['SURNAME'] }),
    })
  );
  expect(res).toEqual([{ value: 'x' }]);
});

test('cleanFio logs warning on failure', async () => {
  fetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });
  const res = await cleanFio('x');
  expect(res).toBeNull();
  expect(warnMock).toHaveBeenCalled();
});
