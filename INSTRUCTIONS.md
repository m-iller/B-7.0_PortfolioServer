# Installation and usage

Portfolio site + DND Telegram bot on **Node 20** and **systemd**. No Docker.

| Path | Contents |
| --- | --- |
| `./data` | SQLite (`portfolio.db`) |
| `./data/dnd` | DND bot JSON (settings, places, polls, roster) |
| `./uploads` | Project images and videos |

Default VPS path used below: `/var/www/B-7.0_PortfolioServer`. If yours differs, edit the two files in `deploy/` before copying them to systemd.

---

## 1. Requirements

On the VPS (Ubuntu):

- Git
- Node.js **20.x** (not 18, not nvm — systemd will not see nvm)
- `openssl` / `ca-certificates` (Ubuntu already has these)

Check:

```bash
git --version
node -v
npm -v
```

`node -v` must start with `v20`.

If Node is missing or wrong:

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v
```

Optional: domain + Nginx/Caddy for HTTPS.

---

## 2. Get the project

```bash
git clone <your-repo-url> /var/www/B-7.0_PortfolioServer
cd /var/www/B-7.0_PortfolioServer
mkdir -p data/dnd uploads
```

If the repo is already there (this VPS):

```bash
cd /var/www/B-7.0_PortfolioServer
git pull origin master
```

---

## 3. Configure environment

```bash
cd /var/www/B-7.0_PortfolioServer
cp -n .env.example .env
```

`-n` does not overwrite an existing `.env`. Edit `.env`:

| Variable | Required | Notes |
| --- | --- | --- |
| `JWT_SECRET` | Yes in production | ≥ 32 random characters. `openssl rand -base64 48` |
| `ADMIN_USERNAME` | Yes | Web admin login |
| `ADMIN_PASSWORD` | Yes | Hashed with bcrypt on boot |
| `PUBLIC_ORIGIN` | Yes | Public URL, e.g. `https://your.domain` |
| `COOKIE_SECURE` | Yes on HTTPS | `true` behind TLS |
| `TELEGRAM_BOT_TOKEN` | No | Empty = bot process idles |
| `TELEGRAM_ADMIN_ID` | No | Numeric Telegram user id |
| `DATABASE_URL` | No | Default SQLite under `./data` |
| `PORT` | No | Default `3000` |

```env
NODE_ENV=production
PUBLIC_ORIGIN=https://your.domain
COOKIE_SECURE=true
JWT_SECRET=<long random value>
ADMIN_PASSWORD=<strong password>
```

Do not commit `.env`.

---

## 4. First deploy on the VPS

**Stop Docker first** so port 3000 is free. Leave `data/` and `uploads/` in place (same folders Docker was bind-mounting).

```bash
cd /var/www/B-7.0_PortfolioServer
docker compose stop || true
```

Build (this is `npm ci` + compile; it is much lighter than a Docker image build):

```bash
cd /var/www/B-7.0_PortfolioServer
npm ci
npx prisma generate
npm run build
npm --prefix frontend ci
npm --prefix frontend run build
npm run seed
```

`seed` creates schema, hashes the admin password, and inserts dummy content only if the database is empty. Existing `data/` is kept.

Install systemd units (edit `WorkingDirectory` in both files if the path is not `/var/www/B-7.0_PortfolioServer`):

```bash
cp /var/www/B-7.0_PortfolioServer/deploy/portfolio-web.service /etc/systemd/system/
cp /var/www/B-7.0_PortfolioServer/deploy/portfolio-bot.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now portfolio-web portfolio-bot
systemctl status portfolio-web --no-pager
systemctl status portfolio-bot --no-pager
```

Open:

- Site: `http://YOUR_VPS_IP:3000`
- Admin: `http://YOUR_VPS_IP:3000/login`
- Health: `http://YOUR_VPS_IP:3000/api/health`

Logs:

```bash
journalctl -u portfolio-web -f
journalctl -u portfolio-bot -f
```

When the site answers, remove Docker with **`DockerCleanup.md`**.

---

## 5. Later updates

```bash
cd /var/www/B-7.0_PortfolioServer
bash scripts/deploy.sh
```

That script: `git pull` → `npm ci` → Prisma generate → backend build → frontend build → seed (skips dummy data if you already have content) → restart both units.

Manual equivalent:

```bash
cd /var/www/B-7.0_PortfolioServer
git pull origin master
npm ci
npx prisma generate
npm run build
npm --prefix frontend ci
npm --prefix frontend run build
npm run seed
systemctl restart portfolio-web portfolio-bot
```

---

## 6. HTTPS / reverse proxy

Keep Node on `127.0.0.1:3000` if the proxy is on the same machine. Set in `.env`:

```env
PORT=3000
PUBLIC_ORIGIN=https://your.domain
COOKIE_SECURE=true
```

Then restart: `systemctl restart portfolio-web`.

Caddy:

```caddy
your.domain {
    reverse_proxy 127.0.0.1:3000
}
```

Nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Open `80`/`443` on the firewall. Do not expose `3000` to the world if the proxy is local.

To bind Node to localhost only, change `src/index.ts` listen address is currently `0.0.0.0`. Firewall-off `3000` is the usual fix without a code change.

---

## 7. Using the website

### Public pages

The home page is a single terminal-style landing with five sections:

- Language toggle `[ EN ]` / `[ RU ]` in the top bar (saved in the browser)
- **Personal** — name, about text, contacts
- **Projects** — bilingual title and description, tag-links, gallery, local videos, optional YouTube
- **Skills** — rows grouped by bilingual category
- **Experience** / **Education** — terminal log lines

### Web admin (`/admin`)

1. Open `/login`.
2. Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
3. You are redirected to `/admin`.

Tabs: Profile, Projects, Skills, Experience, Education. Sessions last 8 hours (`JWT_EXPIRES_IN`).

---

## 8. CLI

Run from the project root (same SQLite + `uploads` as the site):

```bash
cd /var/www/B-7.0_PortfolioServer
npm run cli -- add-skill --name-en "PTC Creo" --name-ru "PTC Creo" --category-en "Mechanics" --category-ru "Механика" --exp 2 --desc-en "Solid modeling" --desc-ru "Твердотельное моделирование"
npm run cli -- add-experience --company "Lab" --role "Engineer" --period "2020-2024" --desc "Work log"
npm run cli -- add-education --institution "University" --specialty "ME" --details "Degree notes"
npm run cli -- set-profile --name-en "Name" --name-ru "Имя" --about-en "Bio" --about-ru "Био"
npm run cli -- add-contact --label-en GitHub --label-ru GitHub --value myuser --url https://github.com/myuser
npm run cli -- list-projects
npm run cli -- list-skills
npm run cli -- cleanup-media
npm run cli -- cleanup-media --force
npm run cli -- add-project
```

`add-project` is interactive: title EN/RU, description EN/RU, YouTube, tag links `Label|https://url`, image paths, video paths.

---

## 9. Telegram bot (DND timetable)

The bot long-polls Telegram. It is **not** the portfolio editor. Portfolio content is still `/admin` or the CLI.

Data: `./data/dnd/` (JSON, keyed by group id). Not the SQLite file.

### Enable

1. [@BotFather](https://t.me/BotFather) → `/newbot` → copy token.
2. BotFather → `/setprivacy` → **Disable**.
3. Add the bot to the group. Allow messages and polls.
4. Optional: numeric user id in `TELEGRAM_ADMIN_ID`.
5. Put token in `.env`, then:

```bash
systemctl restart portfolio-bot
journalctl -u portfolio-bot -n 50 --no-pager
```

Empty `TELEGRAM_BOT_TOKEN`: process stays idle, does not crash.

### Commands (plain text)

Anyone in the group: `dnd help`, `dnd vote start`, `dnd place vote start`, `dnd stats`.

Group creator or `TELEGRAM_ADMIN_ID`: `dnd` / `dnd settings`, `dnd place edit`, `dnd stop`, `dnd always`, `dnd spectators`.

Default auto poll: Monday 00:00 GMT+3. Change in `dnd`.

People who never vote on the day poll count as «Не смогу» (leaderboard + skip-majority). Two or more tied winning days start a «Какой день?» poll (default 6 h) before the place poll.

---

## 10. Backup and restore

```bash
systemctl stop portfolio-web portfolio-bot
cp -a /var/www/B-7.0_PortfolioServer/data /var/www/B-7.0_PortfolioServer/uploads /path/to/backup/
systemctl start portfolio-web portfolio-bot
```

Restore: copy `data` and `uploads` back into the project root, then start the units.

---

## 11. Local development (PC)

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

Hot reload (two terminals): `npm run dev:web` and `npm --prefix frontend run dev` (Vite proxies `/api` and `/uploads`).

Bot: `npm run start:bot`.

---

## 12. Troubleshooting

| Symptom | What to check |
| --- | --- |
| `EADDRINUSE` / port 3000 | Docker still bound to 3000. `docker compose stop`, then `DockerCleanup.md` |
| `JWT_SECRET must be at least 32 characters` | Lengthen `JWT_SECRET`, `systemctl restart portfolio-web` |
| `env node`: No such file | Node 20 not on PATH. Install NodeSource 20.x, not nvm |
| Cannot write database / uploads | `chown -R root:root data uploads` or whatever user the units run as (default root) |
| Admin login rejected | Username/password in `.env`. Restart web after changing them |
| Bot idle, no replies | Token empty, or unit not restarted after `.env` edit |
| Bot ignores `dnd help` in a group | BotFather `/setprivacy` still on. Disable, kick/re-add |
| Images 404 | File missing under `./uploads` |
| Unit failed | `journalctl -u portfolio-web -n 80 --no-pager` |

Health from the VPS:

```bash
curl -sS http://127.0.0.1:3000/api/health
```

---

## 13. Security checklist (production)

- [ ] Unique `JWT_SECRET` (≥ 32 chars)
- [ ] Strong `ADMIN_PASSWORD`
- [ ] `COOKIE_SECURE=true` and HTTPS
- [ ] `PUBLIC_ORIGIN` set to the real HTTPS URL
- [ ] Telegram token only if the DND bot is needed
- [ ] Firewall: do not expose port 3000 if a reverse proxy is used
- [ ] Regular copies of `data/` and `uploads/`
- [ ] Docker removed (`DockerCleanup.md`) so it cannot eat the disk again
