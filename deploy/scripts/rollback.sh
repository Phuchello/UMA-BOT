#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
source "$SCRIPT_DIR/common.sh"
require_root
require_platform
[[ $# == 2 && $2 == --confirm-schema-compatible ]] || fail 'Usage: rollback.sh <prepared-commit-sha> --confirm-schema-compatible'
require_directory "$ROOT"
require_directory "$RELEASES"
require_directory "$DATA"
require_directory "$BACKUPS"
operations_lock
activate_release "$(release_path "$1")"
