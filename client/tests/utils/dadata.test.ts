import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanAddress,
  findBankByBic,
  suggestAddress,
  type AddressSuggestion,
} from '@/dadata';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/api';

const apiFetchMock = vi.mocked(apiFetch);

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('dadata helpers', () => {
  it('returns address suggestions when API succeeds', async () => {
    const suggestions: AddressSuggestion[] = [
      { value: 'Москва, Тверская 1' },
      { value: 'Москва, Арбат 5' },
    ];
    apiFetchMock.mockResolvedValueOnce({ suggestions });
    const result = await suggestAddress(' Москва ');
    expect(result).toEqual(suggestions);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/dadata/suggest-address',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns empty list on empty input or failures', async () => {
    expect(await suggestAddress('')).toEqual([]);
    apiFetchMock.mockRejectedValueOnce(new Error('boom'));
    expect(await suggestAddress('Казань')).toEqual([]);
  });

  it('cleans address values and normalizes errors', async () => {
    apiFetchMock.mockResolvedValueOnce({
      result: { result: 'Россия, Москва' },
    });
    expect(await cleanAddress('Москва')).toEqual({ result: 'Россия, Москва' });

    apiFetchMock.mockRejectedValueOnce(new Error('fail'));
    expect(await cleanAddress('Санкт-Петербург')).toBeNull();
  });

  it('finds bank by BIC or returns null when unavailable', async () => {
    apiFetchMock.mockResolvedValueOnce({ bank: { value: 'Тинькофф' } });
    expect(await findBankByBic('044525974')).toEqual({ value: 'Тинькофф' });

    apiFetchMock.mockRejectedValueOnce(new Error('not found'));
    expect(await findBankByBic('bad')).toBeNull();
  });
});
