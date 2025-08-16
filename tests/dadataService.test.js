/* global fetch, process, global */
import { expect, jest, test } from '@jest/globals';

const warnMock = jest.fn();

global.fetch = jest.fn();

jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: { warn: warnMock },
}));

process.env.DADATA_TOKEN = 'token';

process.env.DADATA_SECRET = 'secret';
const {
  suggestFio,
  cleanFio,
  suggestFmsUnit,
  cleanPassport,
  findBankByBic,
  findOrganizationByInn,
} = await import('../src/services/dadataService.js');

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

test('suggestFmsUnit passes filters', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ suggestions: [{ value: 'dept' }] }),
  });
  const res = await suggestFmsUnit('772-053', [{ region_code: '77' }]);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/suggest/fms_unit'),
    expect.objectContaining({
      body: JSON.stringify({ query: '772-053', filters: [{ region_code: '77' }] }),
    })
  );
  expect(res).toEqual([{ value: 'dept' }]);
});

test('cleanPassport returns first element', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve([{ number: '123' }]),
  });
  const res = await cleanPassport('4509 235857');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('cleaner.dadata.ru'),
    expect.objectContaining({
      body: JSON.stringify(['4509 235857']),
      headers: expect.objectContaining({ 'X-Secret': 'secret' }),
    })
  );
  expect(res).toEqual({ number: '123' });
});

test('findBankByBic returns first suggestion', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ suggestions: [{ value: 'bank' }] }),
  });
  const res = await findBankByBic('044525225');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/findById/bank'),
    expect.objectContaining({
      body: JSON.stringify({ query: '044525225' }),
    })
  );
  expect(res).toEqual({ value: 'bank' });
});

test('findOrganizationByInn returns first suggestion', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ suggestions: [{ value: 'org' }] }),
  });
  const res = await findOrganizationByInn('7707083893');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/findById/party'),
    expect.objectContaining({
      body: JSON.stringify({ query: '7707083893', type: 'LEGAL' }),
    })
  );
  expect(res).toEqual({ value: 'org' });
});

test('returns null when token missing', async () => {
  const original = process.env.DADATA_TOKEN;
  delete process.env.DADATA_TOKEN;
  let res;
  await jest.isolateModulesAsync(async () => {
    const { suggestFio } = await import('../src/services/dadataService.js');
    res = await suggestFio('x');
  });
  expect(res).toEqual([]);
  process.env.DADATA_TOKEN = original;
});

test('returns status 0 when secret missing for cleanPassport', async () => {
  const token = process.env.DADATA_TOKEN;
  const secret = process.env.DADATA_SECRET;
  process.env.DADATA_TOKEN = 'token';
  delete process.env.DADATA_SECRET;
  let res;
  await jest.isolateModulesAsync(async () => {
    const { cleanPassport } = await import('../src/services/dadataService.js');
    res = await cleanPassport('1234');
  });
  expect(res).toBeNull();
  process.env.DADATA_TOKEN = token;
  process.env.DADATA_SECRET = secret;
});

test('request handles fetch rejection', async () => {
  let res;
  await jest.isolateModulesAsync(async () => {
    const { suggestFio } = await import('../src/services/dadataService.js');
    fetch.mockRejectedValueOnce(new Error('fail'));
    res = await suggestFio('x');
  });
  expect(res).toEqual([]);
  expect(warnMock).toHaveBeenCalled();
});
