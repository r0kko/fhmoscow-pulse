# АСОУ ПД Пульс

Автоматизированная система оперативного управления производственной деятельностью. A Node.js REST API built with Express and Sequelize. The project provides JWT-based authentication, logging of requests to PostgreSQL and Swagger API documentation.

## Features

- Express server with modular routing
- PostgreSQL database managed with Sequelize
- JSON Web Token authentication and refresh tokens
- Access token kept only in memory and refreshed on startup when a refresh cookie is present
- Security headers using `helmet`
- Request/response logging persisted to the `logs` table
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
# PASSWORD_PATTERN="(?=.*[A-Za-z])(?=.*\\d)"
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=user@example.com
# SMTP_PASS=secret
# EMAIL_FROM=no-reply@example.com
# REGISTRATION_RATE_WINDOW_MS=3600000
# REGISTRATION_RATE_MAX=5
# RATE_LIMIT_WINDOW_MS=900000
# RATE_LIMIT_MAX=100
# ALLOWED_ORIGINS=http://localhost:5173,http://example.com
# BASE_URL=https://pulse.fhmoscow.com
# COOKIE_DOMAIN=pulse.fhmoscow.com
# SSL_CERT_PATH=/etc/ssl/pulse/fullchain.pem
# SSL_KEY_PATH=/etc/ssl/pulse/privkey.pem
```

Приложение отправляет HTML-письма для подтверждения электронной почты и сброса
пароля. Настроить внешний вид и текст этих писем можно в файлах
`src/templates/verificationEmail.js` и `src/templates/passwordResetEmail.js`.

`PASSWORD_MIN_LENGTH` and `PASSWORD_PATTERN` allow customizing the
password policy for user registration. By default passwords must be at
least eight characters long and contain both letters and numbers.

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

Do **not** set `SSL_CERT_PATH` or `SSL_KEY_PATH` so that the Node.js application
starts in HTTP mode and relies on nginx for TLS termination.

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
