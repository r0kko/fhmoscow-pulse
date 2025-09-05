# АСОУ ПД Пульс

Автоматизированная система оперативного управления производственной деятельностью. A Node.js REST API built with Express and Sequelize. The project provides JWT-based authentication, logging of requests to PostgreSQL and Swagger API documentation.

## Features

- Express server with modular routing
- PostgreSQL database managed with Sequelize
- JSON Web Token authentication and refresh tokens
- Access token kept only in memory and refreshed on startup when a refresh cookie is present
- Security headers using `helmet`
- Request/response logging persisted to the `logs` table
- Structured JSON access logs (stdout) with correlation id
- Swagger documentation available at `/api-docs`
- Docker and docker-compose setup for local development
- CI builds and publishes Docker images to GitHub Container Registry
- Redis-backed login attempt tracking
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
# ALLOWED_ORIGINS=http://localhost:5173,http://example.com
# BASE_URL=https://pulse.fhmoscow.com
# COOKIE_DOMAIN=pulse.fhmoscow.com
# SSL_CERT_PATH=/etc/ssl/pulse/fullchain.pem
# SSL_KEY_PATH=/etc/ssl/pulse/privkey.pem
```

Приложение отправляет HTML-письма для подтверждения электронной почты и сброса
пароля. Настроить внешний вид и текст этих писем можно в файлах
`src/templates/verificationEmail.js` и `src/templates/passwordResetEmail.js`.
Письма о создании и смене статуса обращения формируются в
`src/templates/ticketCreatedEmail.js` и `src/templates/ticketStatusChangedEmail.js`.
Письмо об изменении статуса дополнительно включает тип обращения для удобства пользователя.

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

Do **not** set `SSL_CERT_PATH` or `SSL_KEY_PATH` so that the Node.js application
starts in HTTP mode and relies on nginx for TLS termination.

## Observability (Grafana + Loki + Prometheus)

For a simple but powerful local stack with dashboards, log search, and metrics:

- Quick start: `npm run obs:up` → Grafana at `http://localhost:3001`.
- Details and setup (including Loki logging driver override): see `README_observability.md`.
- Probes and metrics:
  - Liveness: `GET /live`
  - Readiness: `GET /ready`
  - Health summary: `GET /health`
  - Prometheus metrics: `GET /metrics` (optional Basic Auth via `METRICS_USER`/`METRICS_PASS`).

## Production Nginx

- The production Nginx site config is stored in-repo at `infra/nginx/conf.d/pulse.conf` and is mounted into the `nginx` container in `docker-compose.prod.yml`.
- Provide TLS certificates on the host under `/etc/nginx/certs/{fullchain.pem,privkey.pem}` (mounted read‑only into the container).
- Default routing: `/api/*` → `app:3000`; everything else → `client:4173`.
- Security: HSTS + secure headers + deny `/metrics` from the Internet (Prometheus scrapes internally).
- Grafana is exposed on port `3001` directly (not via Nginx). Restrict access with your firewall.

### Operational reports (admin-only)

- CSV export of job runs: `GET /reports/job-runs.csv?days=30`
- CSV aggregate of HTTP errors by path/status: `GET /reports/http-errors.csv?days=7`

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

- Active only: pulls records where `object_status = 'active'`.
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

- Prettier, ESLint, and Jest are available as npm scripts:
  - `npm run format:check` verifies formatting; `npm run format` writes.
  - `npm run lint` runs ESLint; `npm run lint:fix` applies fixes.
  - `npm test` runs the test suite with coverage.

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

- Active only: pulls `object_status = 'active'` and restores soft-deleted.
- Archived/missing: marks local records as soft-deleted.
- Cron schedule is controlled by a single orchestrator (see below). Legacy env `GROUND_SYNC_CRON` is deprecated.
- Manual sync: `POST /api/grounds/sync` (ADMIN).

### Sync orchestrator and metrics

- A single orchestrator runs the pipeline: Clubs → Grounds → Teams → Staff → Players → Tournaments.
- Default schedule: every 6 hours (`SYNC_ALL_CRON`), timezone `Europe/Moscow`.
- All jobs are protected by a Redis-based distributed lock to avoid overlaps across instances.
- Prometheus metrics are exposed at `/metrics` (text format), including job run counts, durations and last run timestamps.

### External DB watcher and taxation check

- External DB watcher: a lightweight cron monitors the external MariaDB availability and immediately triggers a full sync once a connection is established after startup. Configure via `EXT_DB_WATCH_CRON` (default every minute).
- Taxation check cron: periodically validates and updates users’ taxation status by INN in small batches. Configure `TAXATION_CRON` and `TAXATION_CRON_BATCH_SIZE` (default 1).
- Admin panel: System Operations now includes controls to trigger a full sync and a taxation check on demand. API endpoints: `GET/POST /admin-ops/sync/*` and `GET/POST /admin-ops/taxation/*` (ADMIN only).

## Local development

Install dependencies and run the server:

```bash
npm ci
npm start
```

### Lint and format

```bash
npm run lint        # check
npm run lint:fix    # fix issues
npm run format      # format with Prettier
```

### Running tests

```bash
npm test
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

A Vue 3 application lives in the `client` directory. During development you can start it manually or rely on Docker Compose:

```bash
cd client
npm install
npm run dev
```

Running `docker-compose up` will also build the frontend image and serve it on port `5173`.
