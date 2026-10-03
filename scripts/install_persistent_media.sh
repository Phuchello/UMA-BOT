#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Error: This script must be run as root (e.g., sudo ./scripts/install_persistent_media.sh)" >&2
  exit 1
fi

SOURCE_DIR="${1:-/tmp/misaka_staging}"
TARGET_DIR="/var/lib/uma-bot/media/misaka"

if [[ ! -d "$SOURCE_DIR" || ! -f "$SOURCE_DIR/catalog.json" ]]; then
  echo "Error: Source directory $SOURCE_DIR does not exist or lacks catalog.json" >&2
  exit 1
fi

echo "==> Ensuring service user 'uma-bot' exists..."
if ! id "uma-bot" >/dev/null 2>&1; then
  useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin uma-bot
  echo "Created system user and group 'uma-bot'."
else
  echo "System user 'uma-bot' already exists."
fi

echo "==> Creating persistent directory structure under $TARGET_DIR..."
install -d -o uma-bot -g uma-bot -m 755 /var/lib/uma-bot
install -d -o uma-bot -g uma-bot -m 755 /var/lib/uma-bot/media
install -d -o uma-bot -g uma-bot -m 755 "$TARGET_DIR"

echo "==> Copying curated reaction media from $SOURCE_DIR..."
cp -r "$SOURCE_DIR"/* "$TARGET_DIR"/

echo "==> Setting safe permissions (dirs: 755, files: 644, owner: uma-bot:uma-bot)..."
chown -R uma-bot:uma-bot "$TARGET_DIR"
find "$TARGET_DIR" -type d -exec chmod 755 {} +
find "$TARGET_DIR" -type f -exec chmod 644 {} +

echo "==> Verifying permissions and structure..."
ls -ld "$TARGET_DIR"
ls -la "$TARGET_DIR"
echo "==> Installation complete!"
