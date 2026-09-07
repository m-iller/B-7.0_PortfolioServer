# Remove Docker completely (Ubuntu VPS)

**Warning:** This deletes Docker Engine, Compose, images, containers, build cache, and Docker’s own data under `/var/lib/docker`. It cannot be undone.

This does **not** delete the app. Leave these folders alone:

- `/var/www/B-7.0_PortfolioServer/data`
- `/var/www/B-7.0_PortfolioServer/uploads`
- `/var/www/B-7.0_PortfolioServer/.env`

Do this **after** Node + systemd is running (see `INSTRUCTIONS.md`). If you wipe Docker while nothing else is serving port 3000, the site goes down.

Run every command as `root` on the VPS.

---

## 1. Stop the app containers

```bash
cd /var/www/B-7.0_PortfolioServer
docker compose stop
docker compose down
```

If Compose is already dead, continue.

Stop anything else Docker still has:

```bash
docker ps -aq | xargs -r docker stop
docker ps -aq | xargs -r docker rm -f
```

---

## 2. Stop Docker services

```bash
systemctl stop docker.socket docker containerd || true
systemctl disable docker.socket docker containerd || true
```

---

## 3. Uninstall packages (apt)

Cover both Docker’s own repo (`docker-ce`) and Ubuntu’s packages (`docker.io`):

```bash
apt-get purge -y \
  docker-ce \
  docker-ce-cli \
  docker-ce-rootless-extras \
  docker-buildx-plugin \
  docker-compose-plugin \
  docker-compose \
  docker-compose-v2 \
  docker.io \
  docker-doc \
  docker-registry \
  containerd.io \
  containerd \
  runc \
  || true

apt-get autoremove -y --purge
apt-get autoclean
```

`|| true` is only so a missing package name does not abort the rest.

---

## 4. Snap (only if `snap list` shows docker)

```bash
snap list 2>/dev/null | grep -i docker || true
snap remove docker || true
```

---

## 5. Delete Docker files and apt repo

```bash
rm -rf /var/lib/docker
rm -rf /var/lib/containerd
rm -rf /etc/docker
rm -rf /var/run/docker
rm -f /var/run/docker.sock
rm -rf /root/.docker
rm -rf /home/*/.docker
rm -f /etc/apt/keyrings/docker.gpg
rm -f /etc/apt/keyrings/docker.asc
rm -f /etc/apt/sources.list.d/docker.list
rm -f /etc/apt/sources.list.d/docker.sources
```

If a `docker` group still exists:

```bash
getent group docker && groupdel docker || true
```

Reload apt so the Docker repo is gone:

```bash
apt-get update
```

---

## 6. Confirm it is gone

```bash
command -v docker && echo "ERROR: docker binary still on PATH" || echo "docker binary: gone"
dpkg -l | grep -iE 'docker|containerd' || echo "no docker/containerd packages"
systemctl is-active docker 2>/dev/null || echo "docker service: not active"
df -h /
```

You want: no `docker` binary, no docker packages (or only unrelated leftover docs you can ignore), disk space back.

A reboot is optional. It is not required if `docker` is already gone:

```bash
reboot
```

---

## 7. If something remains

- `docker: command not found` is success.
- If `apt-get purge` says a package is not installed, that is fine.
- If `/var/lib/docker` refuses to delete, Docker is still running. Repeat step 2, then `rm -rf /var/lib/docker` again.
- Never run `rm -rf` on `/var/www/B-7.0_PortfolioServer`.
