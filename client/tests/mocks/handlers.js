import { http, HttpResponse } from 'msw';

export const handlers = [
  // Basic health for examples/tests
  http.get('/api/ping', () => HttpResponse.json({ ok: true })),

  // Auth endpoints used by app boot
  http.post('*/auth/login', async () =>
    HttpResponse.json({
      access_token: 'login.token.stub',
      user: { id: 1, status: 'ACTIVE' },
      roles: [],
      must_change_password: false,
    })
  ),
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

  // Dashboard shortcuts (safe defaults, overridable in tests)
  http.get('*/courses/me', () => HttpResponse.json({ course: null })),
  http.get('*/users/me/sport-schools', () =>
    HttpResponse.json({ has_club: false, has_team: false })
  ),
  http.get('*/camp-trainings/me/upcoming', () =>
    HttpResponse.json({ trainings: [] })
  ),
  http.get('*/medical-exams/me/upcoming', () =>
    HttpResponse.json({ exams: [] })
  ),
  http.get('*/course-trainings/me/upcoming', () =>
    HttpResponse.json({ trainings: [] })
  ),
];
