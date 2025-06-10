# FH Moscow Pulse

A Node.js REST API built with Express and Sequelize. The project provides JWT-based authentication, logging of requests to PostgreSQL and Swagger API documentation.

## Features

- Express server with modular routing
- PostgreSQL database managed with Sequelize
- JSON Web Token authentication and refresh tokens
- Request/response logging persisted to the `logs` table
- Swagger documentation available at `/api-docs`
- Docker and docker-compose setup for local development
- ESLint and Prettier for code quality
- Jest unit tests

## Branching strategy

Active development takes place on the `dev` branch. Stable releases are
pushed to the `main` branch, which represents the pro version. Pull
requests should target `dev` first, and changes are later merged into
`main` once they are production ready.

## Requirements

- Node.js 20+
- PostgreSQL 15+
- npm

## Environment variables

Create a `.env` file with at least the following variables:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fhpulse
DB_USER=postgres
DB_PASS=secret
JWT_SECRET=your_jwt_secret
# optional overrides
# JWT_ACCESS_TTL=15m
# JWT_REFRESH_TTL=30d
# JWT_ALG=HS256
```

## Running with Docker

The easiest way to start the application together with PostgreSQL is using Docker Compose:

```bash
docker-compose up --build
```

The API will be available at `http://localhost:3000` and Swagger docs at `http://localhost:3000/api-docs`.

On container start, migrations and seeders are run automatically.

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
```

## License

MIT

### Frontend development

A Vue 3 application lives in the `client` directory. Install its dependencies and run the development server:

```bash
cd client
npm install
npm run dev
```
