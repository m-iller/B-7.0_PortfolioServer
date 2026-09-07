# Portfolio Server

Personal portfolio / resume site (terminal UI), `/admin` panel, and a DND Telegram timetable bot. Runs as two Node processes under systemd.

## Stack

- **Web:** Express + React (Vite)
- **DB:** SQLite via Prisma
- **Bot:** Telegraf long-polling worker
- **Auth:** bcrypt, JWT HttpOnly cookies, CSRF, Helmet CSP, Zod

## VPS deploy

Full steps: **[INSTRUCTIONS.md](INSTRUCTIONS.md)**. After Node is up, wipe Docker: **[DockerCleanup.md](DockerCleanup.md)**.

```bash
cd /var/www/B-7.0_PortfolioServer
# .env already filled
npm ci
npx prisma generate
npm run build
npm --prefix frontend ci
npm --prefix frontend run build
npm run seed
cp deploy/portfolio-web.service deploy/portfolio-bot.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now portfolio-web portfolio-bot
```

Later: `bash scripts/deploy.sh`

Open [http://localhost:3000](http://localhost:3000). Admin: `/login` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

Data:

- `./data` — SQLite
- `./data/dnd` — bot JSON
- `./uploads` — images / videos

## Environment

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | ≥ 32 chars in production |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | hashed with bcrypt on boot |
| `TELEGRAM_BOT_TOKEN` | empty = bot process idles |
| `TELEGRAM_ADMIN_ID` | optional global DND settings admin |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `PUBLIC_ORIGIN` | public site URL |
| `UPLOAD_MAX_MB` | image/video size cap (default 64) |

## CLI

```bash
npm run cli -- add-skill --name-en "PTC Creo" --name-ru "PTC Creo" --category-en "Mechanics" --category-ru "Механика" --exp 2 --desc-en "Solid modeling" --desc-ru "Твердотельное моделирование"
npm run cli -- add-project
npm run cli -- set-profile --name-en "Name" --name-ru "Имя" --about-en "Bio" --about-ru "Био"
npm run cli -- cleanup-media
```

## Telegram bot

1. BotFather token in `.env`, `/setprivacy` → **Disable**.
2. Optional `TELEGRAM_ADMIN_ID`.
3. `systemctl restart portfolio-bot`.

Commands: `dnd help`, `dnd`, `dnd vote start`, `dnd place vote start`, `dnd place edit`, `dnd stop`, `dnd always`, `dnd spectators`, `dnd stats`.

## Local development

```bash
cp .env.example .env
npm ci
npx prisma generate
npx prisma db push
npm run build
npm --prefix frontend ci
npm --prefix frontend run build
npm run seed
npm run start:web
```

Hot reload: `npm run dev:web` and `npm --prefix frontend run dev`.

On a VDS: TLS in front (Caddy/Nginx), `COOKIE_SECURE=true`, `PUBLIC_ORIGIN=https://your.domain`.
