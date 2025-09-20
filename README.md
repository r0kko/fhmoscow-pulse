# АСОУ ПД Пульс

Автоматизированная система оперативного управления производственной деятельностью. A Node.js REST API built with Express and Sequelize. The project provides JWT-based authentication, logging of requests to PostgreSQL and Swagger API documentation.

## Features

- Express server with modular routing
- PostgreSQL database managed with Sequelize
- JSON Web Token authentication and refresh tokens
- Access token kept only in memory and refreshed on startup when a refresh cookie is present
- Security headers using `helmet`
- Request/response audit logging emitted to stdout (Loki/Grafana); no DB writes
- Structured JSON access logs (stdout) with correlation id
- Swagger documentation available at `/api-docs`
- Docker and docker-compose setup for local development
- CI builds and publishes Docker images to GitHub Container Registry
- Optional Redis-backed login attempt tracking (disabled by default)
- ESLint and Prettier for code quality
- Jest unit tests
- Admin panel for managing users and roles (create, edit, block)
- Soft deletion of records using Sequelize paranoid mode
- Users can have multiple medical certificates. The API returns the
  certificate that is currently valid (issue date in the past and not yet
  expired) while a separate endpoint provides a history of expired
  certificates.
- The personal page warns when a valid certificate is missing and lists
  expired certificates without displaying the taxpayer ID to keep the layout
  compact on small screens.
- Consistent typography with CSS variables. Font sizes shrink slightly on
  narrow screens for better readability.

## Branching strategy

Active development takes place on the `dev` branch. Stable releases are
pushed to the `main` branch, which represents the pro version. Pull
requests should target `dev` first, and changes are later merged into
`main` once they are production ready.

## Requirements

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- npm

## Environment variables

Create a `.env` file with at least the following variables:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fhpulse
DB_USER=postgres
DB_PASS=secret
# Redis connection
REDIS_HOST=localhost
REDIS_PORT=6379
# Alternatively you can set REDIS_URL=redis://host:port
# connection to legacy MySQL database
LEGACY_DB_HOST=legacy-host
LEGACY_DB_PORT=3306
LEGACY_DB_NAME=legacydb
LEGACY_DB_USER=root
LEGACY_DB_PASS=secret
# optional: external MariaDB/MySQL connection (no migrations)
# EXT_DB_HOST=external-host
# EXT_DB_PORT=3306
# EXT_DB_NAME=externaldb
# EXT_DB_USER=external_user
# EXT_DB_PASS=secret
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
# optional overrides
# token for DaData suggestions
VITE_DADATA_TOKEN=your_dadata_api_token
# server-side DaData token
DADATA_TOKEN=your_dadata_api_token
# secret key for passport validation
DADATA_SECRET=your_dadata_secret
# JWT_ACCESS_TTL=15m
# JWT_REFRESH_TTL=30d
# JWT_ALG=HS256
# PASSWORD_MIN_LENGTH=8
# PASSWORD_MAX_LENGTH=128
# PASSWORD_PATTERN="(?=.*[A-Za-z])(?=.*\\d)"
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=user@example.com
# SMTP_PASS=secret
# EMAIL_FROM=no-reply@example.com
# REGISTRATION_RATE_WINDOW_MS=3600000
# REGISTRATION_RATE_MAX=30
# PASSWORD_RESET_RATE_WINDOW_MS=3600000
# PASSWORD_RESET_RATE_MAX=30
# LOGIN_RATE_WINDOW_MS=60000
# LOGIN_RATE_MAX=30
# RATE_LIMIT_WINDOW_MS=60000
# RATE_LIMIT_MAX=1200
# RATE_LIMIT_USE_REDIS=true
#
# Rate limiting and lockout feature flags (API-side)
# RATE_LIMIT_ENABLED=false                   # global default; OFF improves UX
# RATE_LIMIT_GLOBAL_ENABLED=true             # override for global limiter
# RATE_LIMIT_LOGIN_ENABLED=true              # override for /auth/login
# RATE_LIMIT_REGISTRATION_ENABLED=true       # override for registration
# RATE_LIMIT_PASSWORD_RESET_ENABLED=true     # override for password reset
# AUTH_LOCKOUT_ENABLED=false                 # temporary account lock after attempts
# ALLOWED_ORIGINS=http://localhost:5173,http://example.com
# BASE_URL=https://pulse.fhmoscow.com
# COOKIE_DOMAIN=pulse.fhmoscow.com
# SSL_CERT_PATH=/etc/ssl/pulse/fullchain.pem
# SSL_KEY_PATH=/etc/ssl/pulse/privkey.pem

### Troubleshooting: login spinner under CDN/proxy

If the login spinner does not stop after clicking "Войти":

- Client-side API now aborts long requests and will show `Таймаут запроса`. Retry the action.
- Verify `ALLOWED_ORIGINS` includes all SPA origins used by your CDN/domains.
- Set `BASE_URL` to the public HTTPS origin so cookies are issued with `Secure` and `SameSite=None`.
- Prefer leaving `COOKIE_DOMAIN` empty unless you need cross-subdomain cookies; using an incorrect domain can cause browsers to drop cookies.
- Ensure CDN/proxy forwards `Origin` and `X-Forwarded-*` headers and does not cache `/csrf-token` (the API sends `Cache-Control: no-store`).
- Preflight `OPTIONS` requests are handled by the API (204); if your edge blocks OPTIONS, allow it for `/api/*`.
```

Приложение отправляет HTML-письма для подтверждения электронной почты и сброса
пароля. Настроить внешний вид и текст этих писем можно в файлах
`src/templates/verificationEmail.js` и `src/templates/passwordResetEmail.js`.
Письма о создании и смене статуса обращения формируются в
`src/templates/ticketCreatedEmail.js` и `src/templates/ticketStatusChangedEmail.js`.
Письмо об изменении статуса дополнительно включает тип обращения для удобства пользователя.

### Email delivery pipeline

- Письма попадают не напрямую в SMTP, а в очередь `Redis Streams` (`mail:stream:v1`).
  В фоне работает обработчик, который забирает задания с учётом повторных попыток и
  экспоненциальной задержки. Очередь и воркер запускаются автоматически вместе с API.
- При недоступности Redis задание не теряется: сервис пытается отправить письмо напрямую,
  а при сбое — логирует ошибку и увеличивает счётчик `email_queue_failure_total`.
- Настройка ретраев и потоков производится переменными `EMAIL_QUEUE_*` (см. `.env.example`).
  По умолчанию выполняется до пяти попыток с базовой задержкой 15 секунд и верхним пределом 5 минут.
- Метрики Prometheus:
  - `email_queue_enqueued_total{status,purpose}` — поставлено в очередь, запланировано или выполнено напрямую.
  - `email_delivery_duration_seconds{status,purpose}` — время фактической доставки письма.
  - `email_queue_depth{bucket}` — размер активной очереди (`ready`), отложенных писем (`scheduled`) и DLQ (`dead_letter`).
  - `email_queue_retry_total{purpose}` / `email_queue_failure_total{purpose}` — ретраи и попадания в DLQ.
- Эндпоинт `/health` дополнен блоком `email_queue` с оперативным состоянием
  (инициализировано ли подключение, какое имя у consumer group и т. д.).
- Созданные письма получают метаданные (ID пользователя, документ, тренировка и др.), что упрощает аудит и
  фильтрацию логов.
- Мониторинг:
  - Grafana → "Pulse Email Delivery" (и соответствующие панели в "Pulse App Overview") показывают текущий бэколг, DLQ,
    скорость обработки, ретраи и латентность доставки.
  - Alertmanager поднимает алерты при росте очереди, появлении DLQ, частых ошибках и при p95 латентности >15 секунд
    (`infra/observability/alerts.yml`).

`PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`, and `PASSWORD_PATTERN`
allow customizing the password policy for user registration and password changes.
By default passwords must be at least eight characters long, no more than 128
characters, and contain both letters and numbers. Additional server-side checks
reject passwords with whitespace, trivial repeats (e.g. `aaaaaaaa`), and simple
keyboard/alpha sequences (`qwertyui`, `abcdef`, `0123456789`).

Client can retrieve current policy metadata via `GET /auth/password-policy`.
The frontend shows a live strength meter and a checklist with actionable hints.

## Running with Docker

The easiest way to start the application together with PostgreSQL and Redis is using Docker Compose:

The frontend build needs to know where the backend API is running. The
`docker-compose.yml` file passes `VITE_API_BASE=http://localhost:3000` when
building the client image so that API requests in development reach the backend
directly.

```bash
docker-compose up --build
```

The API will be available at `http://localhost:3000` and Swagger docs at `http://localhost:3000/api-docs`.
The frontend will be served at `http://localhost:5173`.
Docker logs for all containers can be viewed at `http://localhost:8080` via [Dozzle](https://github.com/amir20/dozzle).

On container start, migrations and seeders are run automatically.

For production, prebuilt images are published by the CI pipeline to GitHub Container Registry. Configure `APP_IMAGE` and `CLIENT_IMAGE` in your `.env` file and run:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### HTTPS deployment

In production HTTPS is terminated by **nginx**. Place your SSL certificate and
key in `infra/nginx/certs` as `fullchain.pem` and `privkey.pem` respectively
and adjust the reverse proxy configuration in `infra/nginx/conf.d/default.conf`
if needed.

The Node.js backend runs over plain HTTP internally while nginx handles TLS and
forwards requests.

Configure the following environment variables in `.env`:

```bash
BASE_URL=https://pulse.fhmoscow.com
COOKIE_DOMAIN=pulse.fhmoscow.com
ALLOWED_ORIGINS=https://pulse.fhmoscow.com
VITE_API_BASE=/api
VITE_ALLOWED_HOSTS=pulse.fhmoscow.com
```

To enable Cyrillic text in exported PDF documents, provide the
`PDF_FONT_DIR` variable pointing to a directory that contains the
`SBSansText` TrueType fonts. Copy the font files into `assets/fonts` or
reference an existing directory on the system. If the fonts are missing or
cannot be read, the service falls back to builtin PDF fonts which may render
Cyrillic characters incorrectly.

### Document verification via QR

- Generated PDFs include a standardized e‑signature stamp with a QR code that points to a secure URL: `GET /verify?t=<token>`.
- The token is a compact base64url payload (document id, sign id, signer id) with an HMAC signature using `VERIFY_HMAC_SECRET`.
- Backend endpoint: `GET /verify` returns minimal confirmation details if the token is valid. No authentication required.
- SPA route: `/verify` presents a human‑friendly confirmation page; it calls the API endpoint above.
- Configure:
  - `BASE_URL` must be set to the public SPA origin; it is embedded in the QR URL.
  - `VERIFY_HMAC_SECRET` (optional). If unset, the app falls back to `CSRF_HMAC_SECRET` → `JWT_SECRET` → `SESSION_SECRET`.

Stamp sizing and appearance can be tuned via environment variables if required by branding or printer constraints (defaults are sensible for A4):

- `PDF_STAMP_WIDTH`/`PDF_STAMP_HEIGHT` — outer stamp size; default `270x66` px.
- `PDF_STAMP_MIN_WIDTH` — minimal width when auto-shrinking stamp to fit content; default `220` px.
- `PDF_STAMP_PAD_X`/`PDF_STAMP_PAD_Y` — inner padding; default `10/8` px.
- `PDF_STAMP_GAP` — gap between QR and text block; default `10` px.
- `PDF_QR_MIN_SIZE` — minimum QR side; default `40` px to ensure scan reliability.
- `PDF_QR_IDEAL_RATIO` — target ratio of QR side to the smaller inner stamp side; default `0.46` (clamped to `[0.25..0.6]`).
- `PDF_QR_QUIET_MODULES` — QR quiet zone in modules per side; default `4`.

The QR size is computed to stay inside the stamp, balance with the text block, and render sharply (vector when available, crisp pixel snapping otherwise). The stamp border auto-shrinks horizontally to avoid excessive empty space on the right while keeping padding and spacing.

Do **not** set `SSL_CERT_PATH` or `SSL_KEY_PATH` so that the Node.js application
starts in HTTP mode and relies on nginx for TLS termination.

## Observability (Grafana + Loki + Prometheus)

For a simple but powerful local stack with dashboards, log search, and metrics:

- Quick start: `npm run obs:up` → Grafana at `http://localhost:3001`.
- Details and setup (including Loki logging driver override): see `README_observability.md`.
  - Note: cAdvisor is pinned and tuned to reduce noisy logs and CPU usage. Its logs are intentionally excluded from Loki.
- Dashboards:
  - `Pulse Observability Portal` — executive landing with SLO, business KPI highlights, and navigation shortcuts.
  - `Pulse Business Operations` — user/doc backlogs, match/trainings health, and curated logs for support teams.
- Probes and metrics:
  - Liveness: `GET /live`
  - Readiness: `GET /ready`
  - Health summary: `GET /health`
  - Prometheus metrics: `GET /metrics` (optional Basic Auth via `METRICS_USER`/`METRICS_PASS`).

## Maintenance mode (503)

- Purpose: cleanly disable the API during planned work or emergencies and serve a branded, lightweight "Идут технические работы" page to browsers; API clients receive a structured JSON error with `Retry-After`.
- Enable/disable:
  - Set `MAINTENANCE_MODE=true` (in env) or create a flag file at `MAINTENANCE_FILE` path.
  - Optionally set `MAINTENANCE_UNTIL` (ISO or epoch seconds) to populate the `Retry-After` header for clients and an ETA hint on the page.
  - Optional HTML text: `MAINTENANCE_MESSAGE` and contact: `MAINTENANCE_CONTACT`.
- Bypass and health:
  - Paths `/live`, `/ready`, `/health`, `/metrics` are allowed by default; override via `MAINTENANCE_ALLOW_PATHS` (comma-separated, prefix match).
  - Set `MAINTENANCE_BYPASS_TOKEN` and pass header `X-Maintenance-Bypass: <token>` to bypass for admin checks.
  - `MAINTENANCE_ALLOWLIST` lets specific IPs bypass (exact match).
- Behavior:
  - API: `503` with `{ "error": "maintenance" }` and `Retry-After` (if configured).
  - Browser (backend): `503` with an inline, accessible HTML page styled to project design tokens (brand color, rounded sections), no external assets, auto-refresh hint.
  - Metrics: responses are tagged with `X-Maintenance-Mode: 1`; errors counted via `http_error_code_total{code="maintenance",status="503"}`.

### Client behavior (SPA)

- Startup health probe to `/ready`: if backend is unavailable or returns `503`, the SPA routes to `/maintenance` and shows a lightweight, branded page. It auto-retries in the background and reloads when the API is back up.
- Any API call receiving `503` also activates maintenance mode; hints are read from headers:
  - `Retry-After` → ETA text, optional.
  - `X-Maintenance-Message`/`X-Maintenance-Contact` → message and contact on the page.
- Static fallback file is available at `client/public/maintenance.html` for external use.

Optional Nginx fallback: see `infra/nginx/conf.d/maintenance.conf.example` to serve a static maintenance page when upstream returns 502/503/504.

### Compose: динамическое включение без рестартов контейнеров

- Backend (предпочтительно для API):
  - В `docker-compose.prod.yml` примонтирован том `./infra/runtime` в `/runtime` для сервиса `app`.
  - Установите переменную в `.env`:
    - `MAINTENANCE_FILE=/runtime/maintenance.flag`
  - Включить: `touch infra/runtime/maintenance.flag`
  - Отключить: `rm -f infra/runtime/maintenance.flag`
  - Не требуется рестарт контейнера.

- Nginx (глобально на уровне прокси):
  - В `docker-compose.prod.yml` примонтирован том `./infra/nginx/flags` в `/etc/nginx/flags`.
  - Включить: `touch infra/nginx/flags/maintenance.enable`
  - Отключить: `rm -f infra/nginx/flags/maintenance.enable`
  - Nginx по флагу:
    - возвращает `503` на `/api/*` (и отдаёт статический `maintenance.html` через `error_page`),
    - переписывает все запросы на корень (`/`) на статическую страницу `maintenance.html`.
  - Не требуется `reload`/рестарт.

Оба механизма можно комбинировать: включать серверный `503` для API (клиент аккуратно покажет экран техработ) и при необходимости подменять весь сайт статической страницей через Nginx.


## Production Nginx

- The production Nginx site config is stored in-repo at `infra/nginx/conf.d/pulse.conf` and is mounted into the `nginx` container in `docker-compose.prod.yml`.
- Provide TLS certificates on the host under `/etc/nginx/certs/{fullchain.pem,privkey.pem}` (mounted read‑only into the container).
- Default routing: `/api/*` → `app:3000`; everything else → `client:4173`.
- Security: HSTS + secure headers + deny `/metrics` from the Internet (Prometheus scrapes internally).
- Grafana is exposed on port `3001` directly (not via Nginx). Restrict access with your firewall.

### Operational reports (admin-only)

- CSV export of job runs: `GET /reports/job-runs.csv?days=30`
- HTTP errors: Grafana dashboard `Pulse App HTTP (Drill)` (`/d/pulse-app-http-drill/app-http-drill`)
- Live KPIs & backlog health: Grafana dashboards `Pulse Observability Portal` and `Pulse Business Operations`

## External MariaDB models

Integration with the legacy MariaDB is handled via Sequelize models placed in `src/externalModels/`.

- Configure `EXT_DB_*` variables in `.env`.
- Startup probes the connection and continues even if unavailable.
- Models are read‑only and map directly to existing tables.
- The application enforces a strict read‑only guard at the connection level
  (blocks INSERT/UPDATE/DELETE/DDL). Use a DB user with read‑only privileges
  for additional defense‑in‑depth.

### External data synchronization (Teams)

Service `teamService.syncExternal()` imports active teams from the external DB and
soft‑deletes local teams that no longer exist externally:

- Active/new only: pulls records where `object_status` is `'active'` or `'new'`.
- Missing externally: if a local `external_id` is not found in the external set,
  it is soft‑deleted locally (`deleted_at` set).
- Archived externally: records with `object_status = 'archive'` are treated the
  same as missing and are soft‑deleted locally.

Example:

```js
import { isExternalDbAvailable } from './src/config/externalMariaDb.js';
import { User } from './src/externalModels/index.js';

if (isExternalDbAvailable()) {
  const u = await User.findOne({ where: { email: 'user@example.com' } });
}
```

## Quality checks

- `npm run verify` executes ESLint for API and SPA, runs the Prettier check, then executes Jest and Vitest in CI mode. Run it locally before opening a PR.
- `npm run lint:ci` covers both workspaces; use `npm run lint:fix` and `npm run lint:client:fix` for autofix.
- `npm run format` writes formatting changes, while `npm run format:check` validates without touching files.
- `npm run test:ci` runs both suites; `npm run test:coverage` and `npm run test:client:coverage` generate coverage under `coverage/` and `client/coverage/` respectively.
- `npm run qodana:scan` downloads the Qodana CLI (via `npx`) and produces a local HTML/SARIF report under `.qodana/`. Use it to reproduce CI findings.

## Согласования матчей (Match Agreements)

- `GET /matches/:id/agreements` — список предложений/согласований по матчу.
- `POST /matches/:id/agreements` — создать предложение (домашняя команда) или встречное (гостевая), тело: `{ ground_id, date_start, parent_id? }`.
- `POST /matches/:id/agreements/:agreementId/approve` — согласовать ожидающее предложение (гость согласует предложение хозяев; хозяева согласуют встречное).
- `POST /matches/:id/agreements/:agreementId/decline` — отклонить ожидающее предложение.

Правила:

- Предложение может создавать только сотрудник домашней команды на одном из своих закреплённых стадионов.
- Встречное может создавать только сотрудник гостевой команды на своём стадионе.
- Дата `date_start` должна совпадать с датой матча; меняется только время по Москве (хранится в UTC автоматически).
- При согласовании матч обновляется: переносятся стадион и время начала.
- В системе фиксируются типы действий и статусы (ожидает/согласовано/отклонено/заменено).

### External data synchronization (Clubs)

Service `clubService.syncExternal()` mirrors the team flow for clubs and keeps
the local `clubs` table in sync with the external DB (active only, soft‑delete
missing/archived). Team sync is ordered to run after club sync so that local
teams are linked to their parent clubs via `team.club_id`.

Endpoints:

- `GET /api/clubs` — list clubs (ADMIN, SPORT_SCHOOL_STAFF)
- `POST /api/clubs/sync` — trigger manual sync (ADMIN)

### External data synchronization (Stadiums/Grounds)

Grounds are synced from external Stadiums. Only minimal fields are imported for
new entries: `external_id` and `name`. Address can be added later by admins.

- Active/new only: pulls `object_status` in `{ 'active', 'new' }` and restores soft-deleted.
- Archived/missing: marks local records as soft-deleted.
- Cron schedule is controlled by a single orchestrator (see below). Legacy env `GROUND_SYNC_CRON` is deprecated.
- Manual sync: `POST /api/grounds/sync` (ADMIN).

### Sync orchestrator and metrics

- A single orchestrator runs the pipeline: Clubs → Grounds → Teams → Staff → Players → Tournaments.
- Fixed schedule: every 30 minutes (Europe/Moscow).
- All jobs are protected by a Redis-based distributed lock to avoid overlaps across instances.
- Prometheus metrics are exposed at `/metrics` (text format), including job run counts, durations and last run timestamps.

### External DB watcher and taxation check

- External DB watcher: a lightweight cron monitors the external MariaDB availability and immediately triggers a full sync once a connection is established after startup. Fixed schedule: every minute.
- Taxation check cron: periodically validates and updates users’ taxation status by INN in small batches. Configurable batch size via API (no env required). Endpoints: `GET/POST /admin-ops/taxation/*`.
- Admin panel: System Operations includes controls to trigger a full sync and a taxation check on demand. API endpoints: `GET/POST /admin-ops/sync/*` and `GET/POST /admin-ops/taxation/*` (ADMIN only).

## Local development

Install dependencies and run the server:

```bash
npm ci
npm start
```

### Lint, format, and test

```bash
npm run verify      # lint API + SPA, check Prettier, run Jest & Vitest
npm run lint:fix    # auto-fix API lint warnings
npm run lint:client:fix
npm run format      # apply Prettier formatting
```

Run `npm run qodana:scan` to launch the JetBrains Qodana container locally; results land in `.qodana/index.html` and `.qodana/qodana.sarif.json` for sharing or import into IDEs.

### Running tests

```bash
npm test
npm run test:client
npm run test:coverage
```

### User management API

Administrators can manage users via the following endpoints:

- `GET /users` – list all users
- `GET /users/{id}` – fetch single user
- `POST /users` – create user
- `PUT /users/{id}` – update user
- `POST /users/{id}/block` and `/unblock` – change status
- `POST /users/{id}/roles/{roleAlias}` – assign role
- `DELETE /users/{id}/roles/{roleAlias}` – remove role
- `POST /users/{id}/passport` – add passport for user
- `DELETE /users/{id}/passport` – delete passport
- `GET /users/{id}/passport` – fetch passport

## License

MIT

### Frontend development

A Vue 3 single-page app lives in the `client` directory. During development you can start it manually or rely on Docker Compose:

```bash
cd client
npm install
npm run dev
```

Quality gates mirror the backend:

- `npm run lint` / `npm run lint:fix` — ESLint (Vue recommended rules + Prettier).
- `npm run test` — Vitest unit tests (headless `happy-dom`).
- `npm run test:coverage` — coverage report (stored in `coverage/client`).
- `npm run build` — production build, same entrypoint used in CI/CD.

Running `docker-compose up` also builds the frontend image and serves it on port `5173`.
- Admin · Documents/Contracts
  - Contracts tab now supports search and filters (signature type, status, only with contract) for faster navigation.
  - Creating a referee contract sets status to “AWAITING_SIGNATURE” immediately and emails the recipient.
  - The precheck modal shows all normative types for the active season with best results and measurement units.
