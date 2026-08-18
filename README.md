# Portfolio Server

Containerized personal portfolio and resume site with a terminal UI, a protected `/admin` panel, a Telegram ingestion bot, and a Docker CLI.

## Stack

- **Web:** Express + React (Vite), served from one container
- **DB:** SQLite via Prisma (parameterized queries only)
- **Bot:** Telegraf long-polling worker
- **Auth:** bcrypt password hash, JWT in HttpOnly `SameSite=Strict` cookies, HMAC CSRF tokens, Helmet CSP, Zod validation

## Quick start

```bash
cp .env.example .env
# edit JWT_SECRET, ADMIN_PASSWORD, and optional Telegram values
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). First tab is **personal** (name, about, social links and nicknames — all editable in `/admin`). Use `[ EN ]` / `[ RU ]` on the main page to switch language. Admin login: `/login` using `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Projects require both English and Russian title and description.

Volumes:

- `./data` → SQLite file
- `./uploads` → project images and videos

## Environment

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | >= 32 chars in production |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | hashed with bcrypt on boot |
| `TELEGRAM_BOT_TOKEN` | empty = bot container idles |
| `TELEGRAM_ADMIN_ID` | only this Telegram user can write |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `PUBLIC_ORIGIN` | public site URL |
| `UPLOAD_MAX_MB` | image/video size cap (default 64) |
| `MEDIA_CLEANUP_GRACE_MIN` | unused upload files younger than this stay (default 30) |
| `MEDIA_CLEANUP_INTERVAL_MIN` | how often the web container sweeps orphans (default 60) |

## CLI

```bash
docker exec -it portfolio_backend cli add-skill --name "PTC Creo" --category "Mechanics" --exp 2 --desc "Solid modeling, reverse engineering"
docker exec -it portfolio_backend cli add-project
docker exec -it portfolio_backend cli set-profile --name-en "Name" --name-ru "Имя" --about-en "Bio" --about-ru "Био"
docker exec -it portfolio_backend cli add-contact --label-en GitHub --label-ru GitHub --value myuser --url https://github.com/myuser
docker exec -it portfolio_backend cli add-contact --label-en Discord --label-ru Discord --value nickname#0000
docker exec -it portfolio_backend cli cleanup-media
docker exec -it portfolio_backend cli cleanup-media --force
docker exec -it portfolio_backend cli add-experience --company "Lab" --role "Engineer" --period "2020-2024" --desc "Work log"
docker exec -it portfolio_backend cli add-education --institution "University" --specialty "ME" --details "Degree notes"
docker exec -it portfolio_backend cli list-projects
docker exec -it portfolio_backend cli list-skills
```

`add-project` is interactive: title EN, title RU, description EN, description RU, YouTube URL, tag links (`Label|https://...`), image paths, video paths.

## Telegram bot

1. Create a bot with BotFather, put the token in `.env`.
2. Set `TELEGRAM_ADMIN_ID` to your numeric user id.
3. Restart compose. In chat: `/newproject`.

Flow: title EN → title RU → description EN → description RU → photos (`/done`) → videos (`/done` or `skip`) → YouTube URL or `skip` → `Label|url, Label|url` or `skip`.

Other commands: `/help`, `/cancel`.

## Local development (no Docker)

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run build
npm --prefix frontend install
npm --prefix frontend run build
npm run seed
npm run start:web
```

Frontend hot reload: `npm run dev:web` and `npm --prefix frontend run dev` (Vite proxies `/api` and `/uploads`).

## Security notes

- All writes go through Prisma. No string-concatenated SQL.
- Public text is sanitized on input. React escapes on render. No `dangerouslySetInnerHTML`.
- YouTube embeds accept only validated `youtube.com` / `youtu.be` IDs.
- Uploads: jpeg/png/webp/gif and mp4/webm/ogg/mov. Random filenames, path-traversal checks. SVG is rejected (XSS). Unused files in `./uploads` are deleted automatically (grace + hourly sweep). Manual: `cli cleanup-media` or `cli cleanup-media --force`.
- Project photos open fullscreen (Esc / click backdrop). Local videos play with native controls.
- Admin routes require a valid session cookie **and** a matching `X-CSRF-Token`.
- Login is rate-limited.

On a VDS, put TLS in front (Caddy/Nginx), set `COOKIE_SECURE=true` and `PUBLIC_ORIGIN=https://your.domain`.
