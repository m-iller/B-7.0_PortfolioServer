# Installation and usage

Step-by-step guide for running this portfolio server on a local PC or a VDS. The app is designed to run in Docker. Data lives in two host folders so you can move the project between machines without losing content.

| Path | Contents |
| --- | --- |
| `./data` | SQLite database (`portfolio.db`) |
| `./data/dnd` | DND bot JSON (settings, places, active polls) |
| `./uploads` | Project images and videos |

---

## 1. Requirements

Install these on the host (Windows, Linux, or macOS):

- [Docker Engine](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/) (Docker Desktop includes both)
- Git (to clone the repo)
- A browser

Optional:

- A Telegram account, if you want the bot
- A domain and reverse proxy (Caddy or Nginx) for HTTPS on a VDS

Check that Docker works:

```bash
docker --version
docker compose version
```

---

## 2. Get the project

```bash
git clone <your-repo-url> B-7.0_PortfolioServer
cd B-7.0_PortfolioServer
```

If the files are already on disk, `cd` into this directory instead.

Create the data folders if they are missing:

```bash
mkdir -p data uploads
```

On Linux, make sure Docker can write to them:

```bash
chmod 777 data uploads
```

---

## 3. Configure environment

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` before the first public deploy. At minimum change these:

| Variable | Required | Notes |
| --- | --- | --- |
| `JWT_SECRET` | Yes in production | At least 32 random characters. Generate with `openssl rand -base64 48` |
| `ADMIN_USERNAME` | Yes | Web admin login name |
| `ADMIN_PASSWORD` | Yes | Web admin password. Hashed with bcrypt on every boot |
| `PUBLIC_ORIGIN` | Yes | Public URL, e.g. `http://localhost:3000` or `https://your.domain` |
| `COOKIE_SECURE` | Yes on HTTPS | Set `true` when the site is served over TLS |
| `TELEGRAM_BOT_TOKEN` | No | Leave empty to idle the bot container |
| `TELEGRAM_ADMIN_ID` | No | Numeric Telegram user id. Can edit DND settings and places in every group. Group creators can too. |
| `UPLOAD_MAX_MB` | No | Default `64`. Raise this if you upload large videos |
| `MEDIA_CLEANUP_GRACE_MIN` | No | Default `30`. New unused uploads are kept this many minutes so an unsaved admin form can still attach them |
| `MEDIA_CLEANUP_INTERVAL_MIN` | No | Default `60`. Web container sweep interval |
| `PORT` | No | Default `3000` (must match the compose port mapping) |

`DATABASE_URL` in `.env` is for local (non-Docker) runs. Docker Compose always overrides it to `file:/app/data/portfolio.db`.

Do not commit `.env`. It is gitignored.

---

## 4. Start the server (Docker)

From the project root:

```bash
docker compose up --build -d
```

- First build takes a few minutes.
- `-d` runs in the background. Drop `-d` if you want logs in the terminal.

Check status:

```bash
docker compose ps
docker compose logs -f web
```

The web container is named `portfolio_backend`. The bot container is named `portfolio_bot`.

Open:

- Site: http://localhost:3000
- Admin login: http://localhost:3000/login
- Health: http://localhost:3000/api/health

First boot creates the SQLite schema, hashes the admin password, and seeds dummy projects, skills, experience, and education if the tables are empty.

Stop:

```bash
docker compose down
```

`down` does **not** delete `./data` or `./uploads`. Those stay on the host.

---

## 5. VDS / production

1. Copy the project to the server (git clone or `scp` / `rsync`).
2. Install Docker and Compose on the VDS.
3. Create `.env` as in section 3.
4. Set:

   ```env
   NODE_ENV=production
   PUBLIC_ORIGIN=https://your.domain
   COOKIE_SECURE=true
   JWT_SECRET=<long random value>
   ADMIN_PASSWORD=<strong password>
   ```

5. Start with `docker compose up --build -d`.
6. Put TLS in front of port 3000. Example Caddyfile:

   ```caddy
   your.domain {
       reverse_proxy 127.0.0.1:3000
   }
   ```

   Example Nginx location:

   ```nginx
   location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

7. Open `80`/`443` on the firewall. Keep `3000` bound to localhost if the proxy is on the same machine (change the compose port to `127.0.0.1:3000:3000`).

Moving from a PC to a VDS: copy the repo plus the `data/` and `uploads/` folders. Then run `docker compose up --build -d` on the new host.

---

## 6. Using the website

### Public pages

The home page is a single terminal-style landing with five sections:

- Language toggle `[ EN ]` / `[ RU ]` in the top bar (saved in the browser)
- **Personal** — name, about text, and a list of contacts (social links or nicknames without a URL)
- **Projects** — bilingual title and description (both required). Tag-links, photo gallery (click for fullscreen), local videos, optional YouTube embed. The toggle switches the shown language.
- **Skills** — full-width rows grouped by bilingual category. Years, proficiency, and description follow the EN/RU toggle
- **Experience** — terminal log lines (role, company, description switch with language)
- **Education** — terminal log lines (institution, specialty, details switch with language)

### Web admin (`/admin`)

1. Open `/login`.
2. Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
3. You are redirected to `/admin`.

The dashboard has five tabs. Each tab can create, edit, and delete records.

**Profile**

- Name EN + name RU
- About EN + about RU
- Contacts: add as many as you want. Each row has label EN/RU, value (nickname or handle), and optional URL (`https://`, `mailto:`, `tel:`). Leave URL empty for a nickname only.

**Projects**

- Title EN + title RU (both required)
- Description EN + description RU (both required)
- Optional YouTube URL
- Image upload (jpeg / png / webp / gif)
- Video upload (mp4 / webm / ogg / mov)
- Tag-links: label + `https://...` URL (GitHub, Printables, docs, …)

**Skills**

- Title EN/RU, category EN/RU, proficiency EN/RU, description EN/RU (all required)
- Years of experience (number)

**Experience**

- Company EN/RU, role EN/RU, description EN/RU (all required)
- Period (`2020-2024`)

**Education**

- Institution EN/RU, specialty EN/RU, details EN/RU (all required)

Use **[ logout ]** when finished. Sessions last 8 hours (`JWT_EXPIRES_IN`).

---

## 7. CLI (inside the web container)

The CLI writes to the same SQLite file and `uploads` volume as the website.

```bash
docker exec -it portfolio_backend cli add-skill --name-en "PTC Creo" --name-ru "PTC Creo" --category-en "Mechanics" --category-ru "Механика" --exp 2 --desc-en "Solid modeling" --desc-ru "Твердотельное моделирование"
```

Optional: `--proficiency-en Middle --proficiency-ru Средний`. Old single-language flags (`--name`, `--desc`) still copy into both languages.

```bash
docker exec -it portfolio_backend cli add-experience --company "Lab" --role "Engineer" --period "2020-2024" --desc "Work log"
docker exec -it portfolio_backend cli add-education --institution "University" --specialty "ME" --details "Degree notes"
docker exec -it portfolio_backend cli set-profile --name-en "Name" --name-ru "Имя" --about-en "Bio" --about-ru "Био"
docker exec -it portfolio_backend cli add-contact --label-en GitHub --label-ru GitHub --value myuser --url https://github.com/myuser
docker exec -it portfolio_backend cli add-contact --label-en Discord --label-ru Discord --value nickname#0000
docker exec -it portfolio_backend cli list-projects
docker exec -it portfolio_backend cli list-skills
docker exec -it portfolio_backend cli cleanup-media
docker exec -it portfolio_backend cli cleanup-media --force
```

### Interactive project

```bash
docker exec -it portfolio_backend cli add-project
```

The prompt asks for:

1. Title EN
2. Title RU
3. Description EN
4. Description RU
5. YouTube URL (blank to skip)
6. Tag links as `Label|https://url, Label|https://url` (blank to skip)
7. Image paths, comma-separated (host or container paths that the container can read)
8. Video paths, comma-separated (mp4/webm, blank to skip)

Equivalent via npm (note the `--`):

```bash
docker exec -it portfolio_backend npm run cli -- add-skill --name "PTC Creo" --category "Mechanics" --exp 2 --desc "Solid modeling"
```

---

## 8. Telegram bot (DND timetable)

The bot container long-polls Telegram. It is **not** the portfolio editor. Portfolio content is still changed in `/admin` or the CLI. The bot only runs weekly D&D availability polls.

Data lives in `./data/dnd/` (`settings.json`, `places.json`, `polls.json`), keyed by Telegram group id. It does not use the portfolio SQLite file.

### Enable the bot

1. In Telegram, talk to [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token.
2. **Required:** BotFather → `/setprivacy` → **Disable**. Plain-text commands (`dnd help`) do not reach the bot in groups if privacy is on.
3. Add the bot to the group. Give it permission to send messages and polls.
4. Get your numeric user id (for example via `@userinfobot`) if you want a global settings admin.
5. Put values in `.env`:

   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_ADMIN_ID=123456789
   ```

   `TELEGRAM_ADMIN_ID` is optional. Without it, only each group's creator can change settings and places.

6. Restart:

   ```bash
   docker compose up -d --force-recreate bot
   ```

If `TELEGRAM_BOT_TOKEN` is empty, the bot container stays idle and does not crash.

No group id in `.env`. Adding the bot to a group is enough. Several groups can use one bot.

### Commands (plain text, Russian UI)

Anyone in the group:

| Command | Action |
| --- | --- |
| `dnd help` | Command list |
| `dnd vote start` | Start the day poll now (stops an open poll in that group) |
| `dnd place vote start` | Start the place poll now |

Group creator or `TELEGRAM_ADMIN_ID`:

| Command | Action |
| --- | --- |
| `dnd` | Settings (auto weekday/time GMT+3, «Не смогу» toggle, redactable result texts). Also works in private chat: pick a group |
| `dnd place edit` | Add/delete places. Group or private chat |

Default auto poll: Monday 00:00 GMT+3. Change weekday and time in `dnd`. Catch-up: if the bot was down past that minute, it still fires later the same Moscow day.

### Day poll

Question: `Когда свободны?`

Options: Понедельник … Воскресенье, plus `Не смогу`. Non-anonymous, multiple answers, votes can be retracted.

Closes after 12 hours, or when unique voters ≥ `getChatMemberCount` minus bots (lurkers count as missing votes). State is saved so a container restart still closes on time.

Result:

- If anyone picked `Не смогу` and that setting is on: majority is skipped (text is editable).
- Else top 3 days that have at least one vote (zero-vote days are omitted).
- No votes: `Никто ни за что не проголосовал.` (editable).
- Template default: `Большинство выбрало {days}`. Placeholders `{days}` and `{places}`.

If auto place vote is on and majority was not skipped, a place poll starts after the day poll.

### Place poll

Question: `Где?`

Places are stored in `data/dnd/places.json` as `{ "<groupId>": ["Место 1", "Место 2"] }`. Telegram allows at most 10 options. Need at least 2 places for a poll; one place is announced without a poll.

### BotFather

`/setprivacy` → Disable. Restart the bot after changing privacy.


---

## 9. Backup and restore

Stop is optional but safer for a consistent copy:

```bash
docker compose stop
cp -a data uploads /path/to/backup/
docker compose start
```

Windows PowerShell:

```powershell
docker compose stop
Copy-Item -Recurse data, uploads D:\backup\portfolio\
docker compose start
```

Restore: copy `data` and `uploads` back into the project root, then `docker compose up -d`.

---

## 10. Updates

```bash
git pull
docker compose up --build -d
```

Schema changes are applied on container start (`prisma db push`). Seed data is **not** re-inserted if tables already have rows.

Changing `ADMIN_PASSWORD` in `.env` and restarting the web container updates the stored hash.

---

## 11. Local development without Docker

Use this only for coding. Production should stay on Compose.

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

Hot reload (two terminals):

```bash
npm run dev:web
npm --prefix frontend run dev
```

Vite (port 5173) proxies `/api` and `/uploads` to the backend on port 3000.

Bot and CLI without Docker:

```bash
npm run start:bot
npm run cli -- add-skill --name "PTC Creo" --category "Mechanics" --exp 2 --desc "Solid modeling"
```

---

## 12. Troubleshooting

| Symptom | What to check |
| --- | --- |
| `env_file: .env` error | `.env` is missing. Copy it from `.env.example` |
| Web exits: `JWT_SECRET must be at least 32 characters` | Lengthen `JWT_SECRET` in production |
| Cannot write database / uploads | `chmod 777 data uploads` on Linux, or recreate the folders |
| Admin login rejected | Username/password must match `.env`. Restart web after changing them |
| Bot idle, no replies | Token empty, or container not recreated after editing `.env` |
| Bot ignores `dnd help` in a group | BotFather `/setprivacy` is still enabled. Disable it, kick/re-add the bot |
| Bot: cannot start poll | Bot needs permission to send messages and polls |
| Images 404 | File missing under `./uploads`, or path not starting with `/uploads/` |
| CSRF / 403 on admin | Hard-refresh `/login`, then sign in again |
| Port already in use | Change the left side of `"3000:3000"` in `docker-compose.yml` |

Useful logs:

```bash
docker compose logs -f web
docker compose logs -f bot
docker exec -it portfolio_backend wget -qO- http://127.0.0.1:3000/api/health
```

---

## 13. Security checklist (production)

- [ ] Unique `JWT_SECRET` (≥ 32 chars)
- [ ] Strong `ADMIN_PASSWORD`
- [ ] `COOKIE_SECURE=true` and HTTPS
- [ ] `PUBLIC_ORIGIN` set to the real HTTPS URL
- [ ] Telegram token set only if the DND bot is needed; `TELEGRAM_ADMIN_ID` is the global settings admin
- [ ] Host firewall: do not expose port 3000 to the world if a reverse proxy is used
- [ ] Regular copies of `data/` and `uploads/`
