#!/usr/bin/env bash
# Packshot Studio - install or update on a fresh Ubuntu/Debian VPS (e.g. one.com VPS).
# Run as root:  bash install-server.sh
set -euo pipefail

REPO="https://github.com/pieterlambregs/pieterlambregs.git"
BRANCH="claude/packshot-studio-8x67yx"
DIR="/opt/packshot"

if [ "$(id -u)" -ne 0 ]; then echo "Run as root (sudo bash install-server.sh)"; exit 1; fi

echo "== 1/5 Docker"
if ! command -v docker >/dev/null; then
  apt-get update -y && apt-get install -y ca-certificates curl git
  curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null || (apt-get update -y && apt-get install -y git)

echo "== 2/5 Code"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" reset -q --hard "origin/$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR/packshot-studio"

echo "== 3/5 Settings"
if [ ! -f .env ]; then
  read -rp "Domain for the app (e.g. packshot.artlab-media.be): " DOMAIN
  USERS=""
  while true; do
    read -rp "Login name (empty = done): " U
    [ -z "$U" ] && break
    read -rsp "Password for $U (no commas or colons, at least 10 characters): " P; echo
    if [ ${#P} -lt 10 ] || [[ "$P" == *","* ]] || [[ "$P" == *":"* ]]; then echo "  not accepted, try again"; continue; fi
    USERS="${USERS:+$USERS,}$U:$P"
  done
  if [ -z "$USERS" ]; then echo "At least one login is required."; exit 1; fi
  printf 'PACKSHOT_DOMAIN=%s\nPACKSHOT_USERS=%s\n' "$DOMAIN" "$USERS" > .env
  chmod 600 .env
fi

echo "== 4/5 Firewall"
if command -v ufw >/dev/null; then ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw --force enable >/dev/null; fi

echo "== 5/5 Build and start (first time 5-15 minutes)"
docker compose -f docker-compose.yml -f deploy/docker-compose.server.yml up -d --build

DOMAIN=$(grep '^PACKSHOT_DOMAIN=' .env | cut -d= -f2)
echo
echo "Done. Open https://$DOMAIN (the certificate can take a minute the first time)."
echo "Logs: cd $DIR/packshot-studio && docker compose -f docker-compose.yml -f deploy/docker-compose.server.yml logs -f"
