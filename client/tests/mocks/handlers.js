import { http, HttpResponse } from 'msw';

export const handlers = [
  // Basic health for examples/tests
  http.get('/api/ping', () => HttpResponse.json({ ok: true })),

  // Auth endpoints used by app boot
  http.post('/api/auth/refresh', async () =>
    HttpResponse.json({
      access_token: 'test.token.value',
      user: null,
      roles: [],
    })
  ),
  http.get('/api/auth/me', async () =>
    HttpResponse.json({ user: { id: 1, first_name: 'Тест' }, roles: [] })
  ),
  http.get('/api/csrf-token', async () =>
    HttpResponse.json({ csrfHmac: 'dummy.hmac.token' })
  ),
];
