#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
source "$SCRIPT_DIR/common.sh"
require_root
require_platform
for dir in /opt/uma-bot /opt/uma-bot/releases /var/lib/uma-bot /var/lib/uma-bot/backups /etc/uma-bot /var/cache/uma-bot /run/uma-bot-ops; do
  [[ ! -e $dir && ! -L $dir ]] || require_directory "$dir"
done
for user in uma-bot uma-build; do
  if ! id "$user" >/dev/null 2>&1; then
    useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$user"
  fi
  [[ $(id -u "$user") -ne 0 && $(getent passwd "$user" | cut -d: -f7) == /usr/sbin/nologin ]] || fail 'Dedicated non-root nologin accounts required.'
done
install -d -o root -g root -m 755 "$ROOT" "$RELEASES"
install -d -o uma-bot -g uma-bot -m 700 "$DATA" "$BACKUPS"
install -d -o root -g root -m 700 /etc/uma-bot
install -d -o root -g root -m 755 /var/cache/uma-bot
for unit in uma-bot.service uma-bot-backup.service uma-bot-backup.timer uma-bot-commands.service; do
  install -o root -g root -m 644 "$SCRIPT_DIR/../systemd/$unit" "/etc/systemd/system/$unit"
done
install -o root -g root -m 644 "$SCRIPT_DIR/../systemd/uma-bot-ops.conf" /etc/tmpfiles.d/uma-bot-ops.conf
systemd-tmpfiles --create /etc/tmpfiles.d/uma-bot-ops.conf
systemctl daemon-reload
printf '%s\n' 'Installed service templates; no service enabled/started, no commands registered.'
if [[ ! -f $ENV_FILE ]]; then
  printf '%s\n' 'Create root-owned mode-600 /etc/uma-bot/uma-bot.env privately before activation.'
fi
