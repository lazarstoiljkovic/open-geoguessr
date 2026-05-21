#!/bin/bash
# Run this once on a fresh Hetzner Ubuntu 22.04 server (as root or with sudo)
# Usage: bash setup.sh api.YOURDOMAIN.com

set -e

DOMAIN=${1:?Usage: bash setup.sh api.YOURDOMAIN.com}

echo "==> Installing dependencies"
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git

echo "==> Enabling Docker"
systemctl enable --now docker

echo "==> Obtaining SSL certificate for $DOMAIN"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@"${DOMAIN#*.}"

echo "==> Configuring Nginx"
cp /root/open-geoguessr/deploy/nginx.conf /etc/nginx/sites-available/open-geoguessr
sed -i "s/api.YOURDOMAIN.com/$DOMAIN/g" /etc/nginx/sites-available/open-geoguessr
ln -sf /etc/nginx/sites-available/open-geoguessr /etc/nginx/sites-enabled/open-geoguessr
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "==> Done. Next steps:"
echo "    1. cd /root/open-geoguessr/api"
echo "    2. cp .env.production.example .env.production && nano .env.production"
echo "    3. docker compose up -d --build"
