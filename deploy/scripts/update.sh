#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
source "$SCRIPT_DIR/common.sh"
require_root
require_platform
[[ $# -ge 1 && $# -le 2 ]] || fail 'Usage: update.sh <commit-or-tag> [--activate]'
ref=$1
mode=${2:---build-only}
[[ $mode == --build-only || $mode == --activate ]] || fail 'Unknown release mode.'
[[ $ref =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ && $ref != *..* && $ref != */ ]] || fail 'Unsafe git ref.'
KEEP_RELEASES=${KEEP_RELEASES:-3}
[[ $KEEP_RELEASES =~ ^[0-9]+$ && $KEEP_RELEASES -ge 2 && $KEEP_RELEASES -le 100 ]] || fail 'KEEP_RELEASES must be 2..100.'
require_directory "$ROOT"
require_directory "$RELEASES"
require_directory /var/cache/uma-bot
operations_lock
staging=$(mktemp -d /var/cache/uma-bot/build.XXXXXXXX)
chown uma-build:uma-build "$staging"
build() { runuser -u uma-build -- env -i PATH=/usr/bin:/bin HOME="$staging" CI=true NODE_ENV=test "$@"; }
# No production env/token/DB access in dependency scripts or tests.
build git clone --no-checkout -- https://github.com/Phuchello/UMA-BOT.git "$staging/source"
build git -C "$staging/source" fetch -- origin "$ref"
build git -C "$staging/source" checkout --detach FETCH_HEAD
sha=$(build git -C "$staging/source" rev-parse HEAD)
[[ $sha =~ ^[0-9a-f]{40}$ ]] || fail 'Cannot resolve commit.'
if [[ -e $RELEASES/$sha || -L $RELEASES/$sha ]]; then
  prepared=$(release_path "$sha")
  if [[ $mode == --activate ]]; then
    require_directory "$DATA"
    require_directory "$BACKUPS"
    activate_release "$prepared"
  else
    printf 'Already prepared: %s; no activation performed.\n' "$sha"
  fi
  exit 0
fi
build /usr/bin/npm --prefix "$staging/source" ci
build /usr/bin/npm --prefix "$staging/source" run typecheck
build /usr/bin/npm --prefix "$staging/source" test
build /usr/bin/npm --prefix "$staging/source" run build
build git -C "$staging/source" diff --check
[[ -z $(build git -C "$staging/source" status --porcelain) ]] || fail 'Build changed repository files.'
# Own code as root before making it selectable by the service.
[[ ! -L $staging/source && $(realpath -e -- "$staging/source") == "$staging/source" ]] || fail 'Unsafe build directory.'
[[ ! -e $staging/source/.uma-release && ! -L $staging/source/.uma-release ]] || fail 'Unexpected release marker.'
chown -R -h root:root "$staging/source"
chmod -R go-w,u+rwX,go+rX "$staging/source"
printf '%s\n' "$sha" > "$staging/source/.uma-release"
chmod 644 "$staging/source/.uma-release"
mv -T -- "$staging/source" "$RELEASES/$sha"
printf 'Prepared release: %s\nRetain at least %s releases; automatic deletion is disabled.\n' "$sha" "$KEEP_RELEASES"
if [[ $mode == --activate ]]; then
  require_directory "$DATA"
  require_directory "$BACKUPS"
  activate_release "$(release_path "$sha")"
else
  printf '%s\n' 'Build only: current not switched, service not started, no Discord action.'
fi
