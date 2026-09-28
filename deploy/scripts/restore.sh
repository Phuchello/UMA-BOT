#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
source "$SCRIPT_DIR/common.sh"
require_root
require_platform
[[ $# == 2 && $2 == --confirm-replace-database ]] || fail 'Usage: restore.sh /var/lib/uma-bot/backups/<backup>.sqlite --confirm-replace-database'
require_directory "$DATA"
require_directory "$BACKUPS"
operations_lock
require_stopped
release=$(current_release)
validate_env "$release"
backup=$(realpath -e -- "$1")
[[ $1 == "$backup" && ${backup%/*} == "$BACKUPS" && -f $backup && ! -L $backup ]] || fail 'Backup must be an explicit regular file directly inside backups.'
# Database work runs as the service account, never as root.
runuser -u uma-bot -- env -i PATH=/usr/bin:/bin DATABASE_PATH="$DB" /usr/bin/node "$release/dist/operations/restore.js" "$backup"
printf '%s\n' 'Restore finished; bot remains stopped. Human review and authorized start are required.'
