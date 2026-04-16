#!/usr/bin/env bash
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
DIR="/var/www/signage"
WEB_USER="www-data"

TMP_DIR="/tmp/signage-update"
ASSETS_BACKUP="$TMP_DIR/assets"
STATE_BACKUP="$TMP_DIR/state.json"
REFRESH_CMD_BACKUP="$TMP_DIR/refresh_cmd.txt"

echo "── Signage Updater ──"

# ── Prepare temp backup ──────────────────────────────────────────────────────
mkdir -p "$TMP_DIR"

echo "▸ Backing up runtime data…"

if [[ -d "$DIR/assets" ]]; then
  rm -rf "$ASSETS_BACKUP"
  cp -r "$DIR/assets" "$ASSETS_BACKUP"
fi

if [[ -f "$DIR/state.json" ]]; then
  cp "$DIR/state.json" "$STATE_BACKUP"
fi

if [[ -f "$DIR/refresh_cmd.txt" ]]; then
  cp "$DIR/refresh_cmd.txt" "$REFRESH_CMD_BACKUP"
fi

# ── Update repository safely ─────────────────────────────────────────────────
echo "▸ Updating repository…"

git -C "$DIR" reset --hard
git -C "$DIR" clean -fd
git -C "$DIR" pull --ff-only

# ── Restore runtime data ─────────────────────────────────────────────────────
echo "▸ Restoring runtime data…"

mkdir -p "$DIR/assets"

if [[ -d "$ASSETS_BACKUP" ]]; then
  cp -r "$ASSETS_BACKUP/." "$DIR/assets/"
fi

if [[ -f "$STATE_BACKUP" ]]; then
  cp "$STATE_BACKUP" "$DIR/state.json"
fi

if [[ -f "$REFRESH_CMD_BACKUP" ]]; then
  cp "$REFRESH_CMD_BACKUP" "$DIR/refresh_cmd.txt"
fi

# ── Permissions ──────────────────────────────────────────────────────────────
echo "▸ Fixing permissions…"

chown -R "${WEB_USER}:${WEB_USER}" "$DIR"
chmod -R 755 "$DIR"
chmod -R 775 "$DIR/assets" 2>/dev/null || true

if [[ -f "$DIR/state.json" ]]; then
  chmod 664 "$DIR/state.json"
fi

# ── Cleanup ──────────────────────────────────────────────────────────────────
rm -rf "$TMP_DIR"

echo "✔ Update complete"
