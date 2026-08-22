# Развёртывание проекта

## Требования

Для запуска проекта на сервере необходимы:

- Linux
- Node.js 24
- npm
- NGINX
- systemd

## Сборка проекта

Перейдите в корневую директорию проекта и установите зависимости:

```bash
npm ci
```

Соберите клиентскую и серверную части:

```bash
npm run build
```

После сборки готовые файлы будут находиться в директориях:

```text
client/dist
server/dist
```

## Настройка NGINX

Скопируйте конфигурацию NGINX:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/million-items
```

Включите конфигурацию сайта:

```bash
sudo ln -s /etc/nginx/sites-available/million-items /etc/nginx/sites-enabled/million-items
```

Проверьте конфигурацию NGINX:

```bash
sudo nginx -t
```

Если ошибок нет, перезагрузите конфигурацию:

```bash
sudo systemctl reload nginx
```

NGINX будет:

- раздавать собранное React-приложение из `client/dist`;
- перенаправлять запросы `/api/*` на Express-сервер по адресу `127.0.0.1:3000`.

## Запуск серверной части

Скопируйте файл службы systemd:

```bash
sudo cp deploy/million-items.service /etc/systemd/system/million-items.service
```

Обновите конфигурацию systemd:

```bash
sudo systemctl daemon-reload
```

Добавьте службу в автозапуск и сразу запустите её:

```bash
sudo systemctl enable --now million-items
```

Проверить состояние приложения можно командой:

```bash
sudo systemctl status million-items
```

Для просмотра журналов серверной части:

```bash
sudo journalctl -u million-items -f
```

## Обновление приложения

После получения новой версии проекта установите зависимости и выполните повторную сборку:

```bash
npm ci
npm run build
```

Затем перезапустите серверную часть:

```bash
sudo systemctl restart million-items
```

И при необходимости перезагрузите конфигурацию NGINX:

```bash
sudo systemctl reload nginx
```
