# SNAF Studio Backend

Backend для чат-виджета, inbox заявок в `admin.html` и Telegram-уведомлений.

## Что умеет

- создаёт chat sessions для сайта;
- отвечает на FAQ-вопросы по `content.json` без LLM;
- принимает заявки и сохраняет их в SQLite;
- отправляет уведомления в Telegram Bot API;
- проверяет GitHub PAT для доступа к inbox в админке;
- отдаёт inbox и позволяет менять статус/заметку заявки.

## Требования

- Node.js `18+`
- npm

## Быстрый старт

1. Скопируйте `.env.example` в `.env`.
2. Заполните переменные окружения.
3. Установите зависимости:

```bash
npm install
```

4. Запустите backend:

```bash
npm start
```

По умолчанию сервис поднимется на `http://localhost:3000`.

## Важные переменные

- `ALLOWED_ORIGINS`: домены сайта и админки, которым разрешён доступ к API.
- `GITHUB_ADMIN_ALLOWLIST`: GitHub-логины администраторов через запятую.
- `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`: для уведомлений о новых заявках.
- `SESSION_SECRET`: секрет для backend-cookie админа.
- `CONTENT_SOURCE_URL`: публичный URL вашего `data/content.json`.
- `SQLITE_PATH`: путь до SQLite-файла.
- `ADMIN_APP_URL`: ссылка на `admin.html`, которая попадёт в Telegram.

## Рекомендуемый прод

- backend на отдельном поддомене, например `https://api.snafstudio.ru`;
- reverse proxy через Nginx;
- `COOKIE_SECURE=true`;
- `COOKIE_SAME_SITE=lax` или `none`, если потребуется другой сценарий cookie;
- systemd/pm2 для рестарта процесса.
