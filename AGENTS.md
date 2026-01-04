# AGENTS — Руководство по репозиторию

## Краткая архитектура
- API: Express 5 (ESM), Sequelize (PostgreSQL), Redis, JWT + refresh cookie, CSRF, rate limiting.
- Клиент: Vue 3 + Vite + Bootstrap, дизайн-код через `client/src/brand.css` и `client/UX_GUIDELINES.md`.
- Интеграции: внешняя MariaDB (read-only), S3 (внутр./внеш.), SMTP, DaData.
- Observability: Prometheus `/metrics`, Loki/JSON-логи, Grafana, OpenTelemetry tracing.

## Структура проекта
- `app.js` — Express app (middleware, маршруты, Swagger).
- `bin/www` — bootstrap сервера, подключение БД/Redis, cron/очереди.
- `src/` — доменная логика:
  - `routes/`, `controllers/`, `services/`, `validators/`, `middlewares/`.
  - `models/`, `migrations/`, `seeders/`.
  - `jobs/`, `queue/`, `workers/`, `telemetry/`, `templates/`.
- `client/` — SPA (Vue 3, Vite), тесты в `client/tests/`.
- `infra/` — docker/nginx/observability.
- `tests/` — Jest (API).

## Бизнес-домены (ключевые)
- Доступ: пользователи, роли, регистрация, восстановление пароля, профили.
- Спорт-операции: клубы, команды, игроки, матчи, турниры, судейство.
- Согласование/перенос матчей, синхронизация статусов со внешней БД.
- Медицина: медцентры, осмотры, справки, допуски.
- Обучение и сборы: курсы, тренировки, сезоны.
- Документы/контракты/подписи, QR-верификация документов.
- Заявки/обращения/задачи, оборудование, отчеты.
- Синхронизация с внешними источниками и хранилищами.

## Команды (API + SPA)
- Установка: `npm ci`
- Запуск API: `npm start`
- Тесты: `npm test` (API), `npm run test:client` (SPA)
- Линт: `npm run lint`, `npm run lint:client`
- Формат: `npm run format`, `npm run format:check`
- Миграции: `npm run migrate`, `npm run migrate:undo`

## Код-стайл и стандарты
- ESM only (`type: module`), без CommonJS.
- Prettier: одинарные кавычки, ;, trailing commas.
- Импорты группируются (eslint-plugin-import).
- Файлы JS: camelCase, тесты: `*.test.js`.

## Бэкенд правила
- Сохраняйте Helmet/CSRF/rate limiting и проверку CORS.
- Внешняя MariaDB — read-only. Разрешенные записи описаны в `src/docs/external-db-write.md`.
- Метрики/логи: структурированные JSON, не логировать PII/секреты.
- Для фоновых задач используйте `withRedisLock` и `withJobMetrics`.

## UI/UX правила
- Дизайн-код и паттерны: `client/UX_GUIDELINES.md`.
- Токены и общий стиль: `client/src/brand.css`.
- Не дублировать стили компонентов в представлениях, использовать базовые компоненты.
- Всегда поддерживать доступность (`aria-*`, `:focus-visible`, адаптивность).

## Конфигурация и безопасность
- Конфигурация — через `.env` (см. `.env.example`). Секреты не коммитить.
- Swagger: `/api-docs` ограничен приватными сетями по умолчанию.
- TLS в проде — через nginx; Node работает по HTTP внутри кластера.

## Проверки перед PR
- `npm run verify` (lint + format check + tests).
- Обновить документацию при изменении потоков/интеграций.
- Добавить тесты на ключевые сценарии или критичные изменения.
