# Runbook: admin user invite delivery

## Что изменилось

- `POST /users` теперь возвращает `delivery` со статусом отправки приглашения.
- Добавлен `POST /users/:id/invite-resend` для повторной отправки инвайта.

## Контракт `delivery`

- `sent`: письмо отправлено напрямую.
- `queued`: письмо принято в очередь отправки.
- `failed`: отправка не удалась, доступен `reason`.

Пример:

```json
{
  "user": { "id": "..." },
  "delivery": {
    "invited": false,
    "channel": "email",
    "status": "failed",
    "reason": "delivery_exception"
  }
}
```

## Диагностика `delivery.failed`

1. Проверить API-ответ `POST /users` или `POST /users/:id/invite-resend`.
2. Проверить структурированные WARN-логи:
   - `operation`: `user_create` или `user_invite_resend`
   - `request_id`
   - `user_id`
   - `reason`
3. Проверить работоспособность очереди email (Redis/worker) и SMTP-конфигурации.

## Повторная отправка

1. В UI на странице создания пользователя нажать «Повторно отправить приглашение».
2. Или вызвать API вручную:

```bash
curl -X POST "$BASE_URL/api/users/<user_id>/invite-resend" \
  -H "Authorization: Bearer <token>"
```

3. Убедиться, что `delivery.status` стал `sent` или `queued`.

## Ограничения

- На endpoint `invite-resend` включён rate limit.
- Тюнинг:
  - `RATE_LIMIT_USER_INVITE_ENABLED`
  - `USER_INVITE_RATE_WINDOW_MS`
  - `USER_INVITE_RATE_MAX`
