#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/backend/.env}"
ACTION="${1:-}"
ASSUME_YES="${ASSUME_YES:-0}"
PRUNE_DAYS="${PRUNE_DAYS:-8}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/db-maintenance.sh <action> [--yes]

Actions:
  status           Show row counts for key tables
  prune-cache      Delete cache rows older than PRUNE_DAYS (default: 8)
  clear-cache      Truncate YouTube cache tables only
  clear-index      Truncate apologetic index table only
  clear-all-data   Truncate index + YouTube cache tables

Options:
  --yes            Skip confirmation for destructive actions

Environment:
  ENV_FILE         Path to env file (default: backend/.env)
  ASSUME_YES=1     Skip confirmation prompts
  PRUNE_DAYS=8     Days threshold for prune-cache action
EOF
}

if [[ "$ACTION" == "--help" || "$ACTION" == "-h" || -z "$ACTION" ]]; then
  usage
  exit 0
fi

if [[ "${2:-}" == "--yes" ]]; then
  ASSUME_YES=1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but was not found"
  exit 1
fi

DB_URL_BASE="${DATABASE_URL%%\?*}"
if [[ "$DATABASE_URL" == *"sslmode=require"* ]]; then
  export PGSSLMODE=require
fi

confirm_if_needed() {
  local message="$1"
  if [[ "$ASSUME_YES" == "1" ]]; then
    return
  fi

  echo "$message"
  read -r -p "Type YES to continue: " answer
  if [[ "$answer" != "YES" ]]; then
    echo "Cancelled"
    exit 1
  fi
}

run_sql() {
  psql "$DB_URL_BASE" -v ON_ERROR_STOP=1 -c "$1"
}

show_status() {
  run_sql "SELECT 'ApologeticIndexItem' AS table_name, COUNT(*) AS rows FROM \"ApologeticIndexItem\" UNION ALL SELECT 'YoutubeSearchCache', COUNT(*) FROM \"YoutubeSearchCache\" UNION ALL SELECT 'YoutubeChannelCache', COUNT(*) FROM \"YoutubeChannelCache\" UNION ALL SELECT 'YoutubeChannelSearchCache', COUNT(*) FROM \"YoutubeChannelSearchCache\" ORDER BY table_name;"
}

case "$ACTION" in
  status)
    show_status
    ;;
  prune-cache)
    if ! [[ "$PRUNE_DAYS" =~ ^[0-9]+$ ]]; then
      echo "PRUNE_DAYS must be a non-negative integer"
      exit 1
    fi
    run_sql "DELETE FROM \"YoutubeSearchCache\" WHERE \"updatedAt\" < NOW() - INTERVAL '$PRUNE_DAYS days';"
    run_sql "DELETE FROM \"YoutubeChannelCache\" WHERE \"updatedAt\" < NOW() - INTERVAL '$PRUNE_DAYS days';"
    run_sql "DELETE FROM \"YoutubeChannelSearchCache\" WHERE \"updatedAt\" < NOW() - INTERVAL '$PRUNE_DAYS days';"
    show_status
    ;;
  clear-cache)
    confirm_if_needed "This will permanently delete all YouTube cache rows."
    run_sql "TRUNCATE TABLE \"YoutubeSearchCache\", \"YoutubeChannelCache\", \"YoutubeChannelSearchCache\" RESTART IDENTITY;"
    show_status
    ;;
  clear-index)
    confirm_if_needed "This will permanently delete all apologetic index rows."
    run_sql "TRUNCATE TABLE \"ApologeticIndexItem\" RESTART IDENTITY;"
    show_status
    ;;
  clear-all-data)
    confirm_if_needed "This will permanently delete all index and cache data."
    run_sql "TRUNCATE TABLE \"ApologeticIndexItem\", \"YoutubeSearchCache\", \"YoutubeChannelCache\", \"YoutubeChannelSearchCache\" RESTART IDENTITY;"
    show_status
    ;;
  *)
    echo "Unknown action: $ACTION"
    usage
    exit 1
    ;;
esac
