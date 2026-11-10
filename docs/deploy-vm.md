# Развёртывание на Linux VM

## Требования

- Linux VM с Docker Engine и Docker Compose plugin;
- домен, направленный на VM;
- reverse proxy с HTTPS (Dokploy/Traefik, Caddy или nginx).

## Первый запуск

```bash
cp .env.example .env
```

Перед production-запуском обязательно замените `POSTGRES_PASSWORD`. Токен
МойСклад пока оставьте пустым, а `MOYSKLAD_SYNC_ENABLED=false`.

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
```

Reverse proxy должен передавать трафик `saitmagnitov.ru` на порт контейнера
`3000`. TLS завершается на reverse proxy.

## Обновление

```bash
git pull --ff-only
docker compose up -d --build
curl -fsS http://127.0.0.1:3000/api/health
```

Тома PostgreSQL не удаляются при обычном обновлении. Перед миграциями и
изменениями схемы БД нужен отдельный backup.
