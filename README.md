# Сайт Магнитов

Клиентская витрина `saitmagnitov.ru`, подготовленная для обычного размещения на
Linux VM:

- главная страница с правками после созвона 15.07.2026;
- каталог с поиском, фильтрами, сортировкой и пагинацией;
- статически генерируемые SEO-карточки товаров;
- корзина и форма заявки без онлайн-оплаты;
- обязательное поле ИНН при оформлении заказа;
- светлая и тёмная тема с выбором по настройке устройства и ручным переключателем;
- страницы согласия и политики, а также закрытая админка каталога и заказов.

Проект не зависит от GPT Sites, Cloudflare Workers, D1 или Wrangler. Production
runtime — стандартный Next.js standalone в Docker.

## Структура

- `app/` — страницы, SEO metadata, sitemap, robots, публичные API и `/admin`;
- `components/` — интерфейс витрины и клиентская корзина;
- `lib/catalog/` — модель каталога и заменяемый repository;
- `lib/integrations/moysklad/` — контракты будущей односторонней синхронизации;
- `reference/original-home.html` — исходный макет v7.1, на котором собрана главная;
- `db/migrations/` — идемпотентная PostgreSQL-схема каталога, заказов, лидов,
  импортов, аудита и админ-сессий;
- `docs/architecture.md` — границы приложения и следующий этап;
- `docs/future-stage-backlog.md` — отложенный объём и критерии открытия будущего этапа;
- `docs/deploy-vm.md` — запуск на Linux VM;
- `Dockerfile`, `docker-compose.yml` — production-сборка, приложение и PostgreSQL.

## SEO

Главная и каталог рендерятся на сервере. Все известные товарные URL
предварительно создаются во время production-сборки через
`generateStaticParams`. Для карточек добавлены canonical URL, Product и
Breadcrumb JSON-LD; сайт публикует `sitemap.xml` и `robots.txt`.

После записи товара или импорта вызывается after-commit ревалидация каталога,
карточки, главной и sitemap — ручная пересборка для публикации товара не нужна.

## Подготовка к МойСклад

Предполагаемый поток данных:

1. МойСклад остаётся единственным источником товарных карточек.
2. Фоновый sync получает новые и изменённые позиции.
3. Mapper преобразует ответы МойСклад во внутренний формат `Product`.
4. PostgreSQL adapter выполняет idempotent upsert по `externalId`.
5. Витрина читает товары через общий `CatalogRepository`.
6. Изменённые SEO-страницы пересобираются или ревалидируются.

Сейчас сетевой клиент МойСклад и запись в него не включены. Токен МойСклад
хранится только в environment VM, синхронизация по умолчанию выключена.

## База, администратор и импорт

```bash
npm run db:migrate
ADMIN_LOGIN=admin ADMIN_PASSWORD='change-me' npm run db:seed-admin
npm run catalog:import -- --dry-run
```

Админка доступна по `/admin`. Сначала проверяйте CSV через dry-run, затем
запускайте apply из `/admin/imports` или командой `npm run catalog:import`.
Изображения сохраняются в `MEDIA_STORAGE_DIR`; схема резервирования описана в
`docs/storage-backup.md`.

## Локальная разработка

Требуется Node.js `>=22.13`.

```bash
npm ci
npm run dev
```

Проверки:

```bash
npm run typecheck
npm run lint
npm test
```

## Запуск в Docker

```bash
cp .env.example .env
docker compose up -d --build
curl -fsS http://127.0.0.1:3000/api/health
```

Перед production-запуском замените пароль PostgreSQL в `.env`. Подробности:
`docs/deploy-vm.md`.

При отсутствии `DATABASE_URL` витрина использует демонстрационный fallback, а
формы показывают успешный demo-ответ без записи. В рабочем окружении заявки,
заказы и аудит сохраняются в PostgreSQL; email-уведомления отправляются через
SMTP с настройками `SMTP_*` и `NOTIFICATION_EMAIL_*`.
