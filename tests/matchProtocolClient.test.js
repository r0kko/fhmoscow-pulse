import { beforeEach, expect, jest, test } from '@jest/globals';

const fetchMock = jest.fn();

jest.unstable_mockModule('node-fetch', () => ({
  __esModule: true,
  default: fetchMock,
}));

jest.unstable_mockModule('../src/config/matchProtocol.js', () => ({
  __esModule: true,
  MATCH_PROTOCOL_CONFIG: {
    apiBase: 'https://protocol.example.test',
    apiKey: 'key.secret',
    timeoutMs: 1000,
  },
}));

const { fetchMatchProtocolPdf } =
  await import('../src/services/matchProtocolClient.js');

beforeEach(() => {
  fetchMock.mockReset();
});

test('fetchMatchProtocolPdf disables automatic redirects for API-key requests', async () => {
  fetchMock.mockResolvedValue({
    status: 304,
    headers: { get: jest.fn().mockReturnValue(null) },
  });

  await fetchMatchProtocolPdf('123');

  expect(fetchMock).toHaveBeenCalledWith(
    'https://protocol.example.test/api/integrations/v1/matches/123/protocol.pdf',
    expect.objectContaining({
      headers: { 'X-API-Key': 'key.secret' },
      redirect: 'error',
    })
  );
});
