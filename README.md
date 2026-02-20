# АСОУ ПД «Пульс»

Платформа для оперативного управления спортивной деятельностью: личные кабинеты, матчи, медицинские допуски, документы и административные операции. Система включает API на Node.js (Express) и SPA-клиент на Vue 3.

## Бизнес-возможности

- Управление пользователями, ролями и профилями, регистрация и восстановление доступа.
- Операции спортивных школ: клубы, команды, игроки, матчи, турниры, судейские назначения.
- Согласование и перенос матчей с синхронизацией во внешнюю БД.
- Медицинские справки, осмотры, медцентры и валидные допуски.
- Курсы, тренировки, сезоны и сборы.
- Документы/контракты, электронные подписи и QR-верификация.
- Обращения/задачи, оборудование, отчеты для администраторов.
- Наблюдаемость, аудит и операционная аналитика.

## Архитектура

- Backend: Express 5 (ESM), Sequelize, PostgreSQL.
- Frontend: Vue 3 + Vite + Bootstrap, дизайн-код в `client/UX_GUIDELINES.md`.
- Состояние/очереди: Redis (сессии, rate limiting, email queue).
- Интеграции: внешняя MariaDB (read-only), S3, SMTP, DaData.
- Observability: Prometheus `/metrics`, JSON-логи (Loki), Grafana, OpenTelemetry.

```
[SPA] ⇄ [API] ⇄ [PostgreSQL]
           ⇄ [Redis]
           ⇄ [External MariaDB]
           ⇄ [S3 / SMTP]
           ⇄ [Grafana/Loki/Prometheus]
```

## Ключевые потоки

- Аутентификация: JWT access + refresh cookie, CSRF, строгие CORS/Helmet.
- Email delivery: очередь на Redis Streams с ретраями и метриками.
- Внешняя синхронизация: оркестратор cron + состояния синхронизаций, read-only политика.
- Документы: PDF + QR-проверка через публичную страницу `/verify` (без авторизации).
- Maintenance mode: API возвращает 503 и отдаёт брендовую страницу техработ.

## Структура репозитория

- `app.js` — Express app (middleware, Swagger, маршруты).
- `bin/www` — bootstrap сервера, подключение БД/Redis, cron/очереди.
- `src/` — доменная логика (controllers/services/routes/models/validators/jobs).
- `client/` — SPA (Vue 3), тесты и UX-гайд.
- `infra/` — Docker, nginx, observability.
- `tests/` — Jest (API), `client/tests/` — Vitest (SPA).

## Быстрый старт (локально)

```bash
npm ci
cp .env.example .env
npm start
```

Клиент отдельно:

```bash
cd client
npm install
npm run dev
```

## Docker

```bash
docker-compose up --build
```

Продакшен-стек:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

TLS завершается в nginx, конфигурации лежат в `infra/nginx/`.

## Конфигурация

- Все переменные — в `.env.example`. Заполняйте `.env`, секреты не коммитить.
- Для QR-верификации в production обязателен `VERIFY_HMAC_SECRET`.
- Группы настроек: БД, JWT/сессии, CORS/CSRF, email, Redis, S3, внешняя БД.
- Swagger `/api-docs` по умолчанию ограничен приватными сетями.

## Аутентификация и блокировки логина

- `authService` различает причины неуспешного логина и пишет метрики `auth_login_attempts_total{reason=...}`:
  - `inactive` (учётка деактивирована),
  - `temporary_lock` (временная блокировка после лимита попыток),
  - `bad_credentials` (неверный пароль),
  - `ip_rate_limited` (сработал rate limit по IP),
  - `ok` (успешный вход).
- Новые коды ошибок:
  - `account_inactive` — деактивированная учётка;
  - `account_locked_temporary` — временная блокировка по попыткам.
- `AUTH_LOCKOUT_ERROR_V2` включает выдачу `account_locked_temporary` в API и UI;
  до включения используется обратная совместимость через `account_locked`.
- Для корректной работы IP-цепочки за CDN/NGINX проверьте `TRUST_PROXY_HOPS`, `RATE_LIMIT_IP_SOURCE`
  и соответствующие `set_real_ip_from`/`real_ip_header` в nginx-конфиге.

## Наблюдаемость

- Метрики: `GET /metrics` (опциональный Basic Auth).
- Health/ready/live: `GET /health`, `GET /ready`, `GET /live`.
- Логи: структурированный JSON (stdout → Loki).
- Локальный стек: `npm run obs:up` (см. `README_observability.md`).

## UI/UX и дизайн-код

- Гайдлайны: `client/UX_GUIDELINES.md`.
- Токены/компоненты: `client/src/brand.css`, `client/src/components/*`.
- Требования: доступность, адаптивность, единые паттерны табов/тайлов.

## Качество и тестирование

- `npm run verify` — lint + format check + тесты (API + SPA).
- API тесты: `npm test` (Jest).
- SPA тесты: `npm run test:client` (Vitest).

## Документация и доп. материалы

- API Swagger: `/api-docs`.
- Политика записи во внешнюю БД: `src/docs/external-db-write.md`.
- Аудит синхронизации: `docs/external-sync-audit.md`.
- Клиентские правила: `client/README.md`.

## Лицензия

MIT
