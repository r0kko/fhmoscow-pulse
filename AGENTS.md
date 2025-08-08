# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (controllers, services, routes, models, middlewares, utils, validators, config, migrations, seeders, templates).
- Entry points: `app.js` (Express app), `bin/www` (server bootstrap). Client lives under `client/`.
- Tests: `tests/*.test.js` (Jest). Coverage output in `coverage/`.
- Assets & infra: `assets/`, `infra/`, `Dockerfile`, `docker-compose*.yml`.

## Build, Test, and Development Commands
- Install: `npm ci` (Node.js 20+ required).
- Start API: `npm start` (runs `bin/www`). Ensure `.env` is configured.
- Test: `npm test` (Jest, ESM enabled). Coverage: `npm run test:coverage`.
- Lint: `npm run lint` | Auto-fix: `npm run lint:fix`.
- Format check: `npm run format:check` | Write: `npm run format`.
- Migrations: `npm run migrate` | Undo all: `npm run migrate:undo`.
- Generate: `npm run migration:create -- <name>` | `npm run seed:create -- <name>`.

## Coding Style & Naming Conventions
- Standard: ESLint (flat config) + Prettier. ESM only (`type: module`).
- Prettier: single quotes, semicolons, trailing commas (see `.prettierrc`).
- Imports: group/order enforced (`eslint-plugin-import`).
- Files: JavaScript filenames use camelCase; tests end with `.test.js`.

## Testing Guidelines
- Framework: Jest (`testEnvironment: 'node'`). Place tests in `tests/` mirroring `src/`.
- Coverage thresholds (jest.config.js): 70% statements/functions/lines, 55% branches.
- Run locally before PR: `npm test`; prefer unit tests with mocks over external I/O.

## Commit & Pull Request Guidelines
- Branches: open PRs against `dev`; `main` is production.
- Commits: concise, imperative English (e.g., `Add login route`).
- PRs: clear description, linked issues, steps to test; include screenshots for client changes.
- Quality gate: ensure `npm test`, `npm run lint`, and `npm run format:check` pass.

## Security & Configuration Tips
- Environment: copy `.env.example` to `.env`; never commit secrets.
- Database: Sequelize paths configured via `.sequelizerc` to `src/{models,migrations,seeders}`.
- Middleware: app uses Helmet and rate limiting—keep security headers intact when modifying routes.
