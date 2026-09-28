#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=/opt/uma-bot
RELEASES=$ROOT/releases
CURRENT=$ROOT/current
DATA=/var/lib/uma-bot
DB=$DATA/tournament.sqlite
BACKUPS=$DATA/backups
ENV_FILE=/etc/uma-bot/uma-bot.env
LOCK=/run/uma-bot-ops/operations.lock
fail() { printf '%s\n' "$*" >&2; exit 1; }
require_root() { [[ $EUID -eq 0 ]] || fail 'Run with sudo/root.'; }
require_platform() {
  [[ $(uname -s) == Linux ]] || fail 'Ubuntu Linux is required.'
  [[ -f /etc/os-release ]] || fail 'Missing operating system metadata.'
  grep -qx 'ID=ubuntu' /etc/os-release || fail 'Ubuntu is required.'
  [[ -x /usr/bin/node && -x /usr/bin/npm ]] || fail 'Install trusted Node/npm at /usr/bin first.'
  /usr/bin/node -e 'const [m,n]=process.versions.node.split(".").map(Number); if(m<22||(m===22&&n<13)) process.exit(1)' || fail 'Node >=22.13 required.'
  /usr/bin/node --input-type=module -e 'import { DatabaseSync } from "node:sqlite";' || fail 'Built-in SQLite unavailable.'
  [[ $(/usr/bin/npm --version | cut -d. -f1) -ge 10 ]] || fail 'npm >=10 required.'
}
require_directory() {
  [[ -d $1 && ! -L $1 && $(realpath -e -- "$1") == "$1" ]] || fail "Unsafe directory: $1"
}
operations_lock() {
  [[ -f $LOCK && ! -L $LOCK && $(stat -c %u -- "$LOCK") == 0 ]] || fail 'Install/recreate the root-owned tmpfiles lock first.'
  exec 9<>"$LOCK"
  flock -n 9 || fail 'Another backup/update/restore operation is running.'
}
release_path() {
  [[ $1 =~ ^[0-9a-f]{40}$ ]] || fail 'An exact lowercase 40-character commit SHA is required.'
  local release=$RELEASES/$1
  [[ -d $release && ! -L $release && $(realpath -e -- "$release") == "$release" ]] || fail 'Release missing or unsafe.'
  [[ $(stat -c %u -- "$release") == 0 && -f $release/.uma-release && $(cat -- "$release/.uma-release") == "$1" ]] || fail 'Not a prepared root-owned release.'
  [[ -f $release/dist/index.js && -f $release/dist/scripts/validateConfig.js ]] || fail 'Release build missing.'
  printf '%s\n' "$release"
}
current_release() {
  [[ -L $CURRENT ]] || fail 'current must be a release symlink.'
  local resolved
  resolved=$(realpath -e -- "$CURRENT")
  [[ $resolved == "$RELEASES/"* ]] || fail 'current is outside releases.'
  release_path "${resolved##*/}"
}
validate_env() {
  [[ -f $ENV_FILE && ! -L $ENV_FILE && $(stat -c %u -- "$ENV_FILE") == 0 && $(stat -c %a -- "$ENV_FILE") == 600 ]] || fail 'Env must be a regular root-owned mode-600 file.'
  /usr/bin/node "$1/dist/scripts/validateConfig.js" --env-file "$ENV_FILE" --expect-database "$DB"
}
require_stopped() {
  local state pid
  state=$(systemctl show uma-bot.service -p ActiveState --value)
  pid=$(systemctl show uma-bot.service -p MainPID --value)
  [[ $state == inactive || $state == failed ]] || fail 'Stop uma-bot.service first.'
  [[ $pid == 0 ]] || fail 'Bot process still exists.'
}
switch_current() {
  local target=$1 candidate=$ROOT/.current-$$-$RANDOM
  [[ ! -e $CURRENT || -L $CURRENT ]] || fail 'Refusing to replace a non-symlink current.'
  ln -s -- "$target" "$candidate"
  mv -Tf -- "$candidate" "$CURRENT"
}
backup_with_release() {
  runuser -u uma-bot -- env -i PATH=/usr/bin:/bin DATABASE_PATH="$DB" /usr/bin/node "$1/dist/operations/scheduledBackup.js"
}
check_service() {
  local attempt
  for attempt in {1..15}; do
    sleep 1
    systemctl is-active --quiet uma-bot.service || return 1
    [[ $(systemctl show uma-bot.service -p NRestarts --value) == 0 ]] || return 1
  done
}
activate_release() {
  local target=$1 previous=''
  [[ ! -e $CURRENT && ! -L $CURRENT ]] || previous=$(current_release)
  validate_env "$target"
  systemctl stop uma-bot.service
  require_stopped
  if [[ -e $DB || -L $DB ]]; then
    [[ -n $previous ]] || fail 'Existing DB without previous release: inspect manually.'
    if ! backup_with_release "$previous"; then
      printf '%s\n' 'Backup failed; release not switched. Previous service remains stopped.' >&2
      return 1
    fi
  fi
  switch_current "$target"
  systemctl reset-failed uma-bot.service
  if systemctl start uma-bot.service && check_service; then
    printf '%s\n' 'Service process stable for 15s. Human /uma doctor and read-only smoke are still required.'
    return 0
  fi
  systemctl stop uma-bot.service
  require_stopped
  if [[ -n $previous ]]; then
    switch_current "$previous"
    systemctl reset-failed uma-bot.service
    systemctl start uma-bot.service
    if ! check_service; then
      systemctl stop uma-bot.service
      printf '%s\n' 'Previous release also failed; bot stopped. Inspect journal and database compatibility.' >&2
    fi
  fi
  printf '%s\n' 'New release failed; previous code restored where available. Database was NOT blindly restored.' >&2
  return 1
}
