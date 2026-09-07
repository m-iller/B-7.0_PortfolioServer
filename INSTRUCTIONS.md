# Installation and usage

Portfolio site + DND Telegram bot on **Node 20** and **systemd**.

VPS app path: **`/var/www/server`**. systemd units in `deploy/` use that path.

| Path | Contents |
| --- | --- |
| `./data` | SQLite (`portfolio.db`) |
| `./data/dnd` | DND bot JSON |
| `./uploads` | Project images and videos |

---

## 1. Requirements

On the VPS (Ubuntu):

- Git
- Node.js **20.x** (not 18, not nvm — systemd will not see nvm)

```bash
git --version
node -v
npm -v
```

`node -v` must start with `v20`. If missing or wrong:

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v
```

Optional: domain + Nginx/Caddy for HTTPS.

---

## 2. First install

### 2.1 Get the code

```bash
git clone <your-repo-url> /var/www/server
cd /var/www/server
mkdir -p data/dnd uploads
```

If the repo is already at `/var/www/server`:

```bash
cd /var/www/server
git pull origin master
```

### 2.2 `.env`

```bash
cd /var/www/server
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

### 2.3 Build

```bash
cd /var/www/server
npm ci
npx prisma generate
npm run build
npm --prefix frontend ci
npm --prefix frontend run build
npm run seed
```

`npx prisma generate` — not `npm prisma generate`. `seed` creates schema, hashes the admin password, inserts dummy content only if the database is empty. Existing `data/` is kept.

### 2.4 systemd

Units must match the real folder. This repo’s units say `/var/www/server`.

```bash
cp /var/www/server/deploy/portfolio-web.service /etc/systemd/system/
cp /var/www/server/deploy/portfolio-bot.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now portfolio-web portfolio-bot
systemctl status portfolio-web --no-pager
systemctl status portfolio-bot --no-pager
```

If status shows `status=200/CHDIR`, `WorkingDirectory` in `/etc/systemd/system/portfolio-*.service` is the wrong path. Fix both files, then:

```bash
systemctl daemon-reload
systemctl reset-failed portfolio-web portfolio-bot
systemctl start portfolio-web portfolio-bot
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

---

## 3. Update (later deploys)

Code already in `/var/www/server`, Node already installed, units already enabled.

```bash
cd /var/www/server
bash scripts/deploy.sh
```

That script: `git pull` → `npm ci` → Prisma generate → backend build → frontend build → seed (skips dummy data if content exists) → restart both units.

Manual equivalent:

```bash
cd /var/www/server
git pull origin master
npm ci
npx prisma generate
npm run build
npm --prefix frontend ci
npm --prefix frontend run build
npm run seed
systemctl restart portfolio-web portfolio-bot
```

If you changed `deploy/*.service`, copy them to `/etc/systemd/system/` again, then `systemctl daemon-reload` before restart.

---

## 4. HTTPS / reverse proxy

Keep Node on port 3000. Set in `.env`:

```env
PORT=3000
PUBLIC_ORIGIN=https://your.domain
COOKIE_SECURE=true
```

Then: `systemctl restart portfolio-web`.

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

---

## 5. Using the website

Public: language toggle, Personal, Projects, Skills, Experience, Education.

Admin: `/login` with `ADMIN_USERNAME` / `ADMIN_PASSWORD`, then `/admin`. Sessions last 8 hours (`JWT_EXPIRES_IN`).

---

## 6. CLI

From the project root:

```bash
cd /var/www/server
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

## 7. Telegram bot (DND timetable)

Not the portfolio editor. Data: `./data/dnd/` JSON.

1. [@BotFather](https://t.me/BotFather) → `/newbot` → token in `.env`.
2. `/setprivacy` → **Disable**.
3. Add bot to the group. Allow messages and polls.
4. Optional `TELEGRAM_ADMIN_ID`.
5. `systemctl restart portfolio-bot`

Empty token: process idles, does not crash.

Anyone: `dnd help`, `dnd vote start`, `dnd place vote start`, `dnd stats`.

Creator / `TELEGRAM_ADMIN_ID`: `dnd` / `dnd settings`, `dnd place edit`, `dnd stop`, `dnd always`, `dnd spectators`.

Silent voters on the day poll count as «Не смогу». Tied winning days start «Какой день?» (default 6 h) before the place poll.

---

## 8. Backup and restore

```bash
systemctl stop portfolio-web portfolio-bot
cp -a /var/www/server/data /var/www/server/uploads /path/to/backup/
systemctl start portfolio-web portfolio-bot
```

Restore: copy `data` and `uploads` back into `/var/www/server`, then start the units.

---

## 9. Local development (PC)

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

Hot reload: `npm run dev:web` and `npm --prefix frontend run dev`. Bot: `npm run start:bot`.

---

## 10. Troubleshooting

| Symptom | What to check |
| --- | --- |
| `status=200/CHDIR` | Unit `WorkingDirectory` does not exist. Must be `/var/www/server` |
| `EADDRINUSE` / port 3000 | Another process on 3000. `ss -tlnp \| grep 3000` |
| `JWT_SECRET must be at least 32 characters` | Lengthen `JWT_SECRET`, restart web |
| `env node`: No such file | Node 20 not on PATH. NodeSource 20.x, not nvm |
| `Unknown command: prisma` | Use `npx prisma generate`, not `npm prisma generate` |
| Admin login rejected | Username/password in `.env`. Restart web after edit |
| Bot idle | Token empty, or unit not restarted after `.env` edit |
| Bot ignores `dnd help` in a group | BotFather `/setprivacy` still on |
| Images 404 | File missing under `./uploads` |
| Unit failed | `journalctl -u portfolio-web -n 80 --no-pager` |

```bash
curl -sS http://127.0.0.1:3000/api/health
```

---

## 11. Security checklist (production)

- [ ] Unique `JWT_SECRET` (≥ 32 chars)
- [ ] Strong `ADMIN_PASSWORD`
- [ ] `COOKIE_SECURE=true` and HTTPS
- [ ] `PUBLIC_ORIGIN` set to the real HTTPS URL
- [ ] Telegram token only if the DND bot is needed
- [ ] Firewall: do not expose port 3000 if a reverse proxy is used
- [ ] Regular copies of `data/` and `uploads/`
