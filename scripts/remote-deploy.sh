#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-apologetics-backend}"
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: remote-deploy.sh [--dry-run]

Options:
  --dry-run   Print commands that would run without executing them
  BRANCH=ref  Environment override to deploy a different branch
  SERVICE_NAME=name  Override systemd service name (default: apologetics-backend)
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "+ $*"
  else
    echo "-> $*"
    "$@"
  fi
}

echo "Deploy script starting (root: $ROOT_DIR)"
echo "Branch: $BRANCH"
echo "Service: $SERVICE_NAME"
echo

cd "$ROOT_DIR"

run git fetch origin
run git checkout "$BRANCH"
run git pull origin "$BRANCH"

cd "$BACKEND_DIR"

# Optional DB backup (user can uncomment to enable)
# run pg_dump "$DATABASE_URL" -Fc -f "/tmp/apologetics-backup-$(date +%F).dump"

run npm ci --no-audit --no-fund
run npm run build
run npm run prisma:generate
run npm run prisma:migrate:deploy

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry-run complete. To actually deploy, run without --dry-run"
  exit 0
fi

echo "Restarting service: $SERVICE_NAME"
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart "$SERVICE_NAME"
  sudo systemctl status "$SERVICE_NAME" --no-pager -n 50
else
  echo "systemctl not available; please restart your process manager (pm2, docker, etc.)"
fi

echo "Deployment finished. Check logs if necessary: sudo journalctl -u $SERVICE_NAME -n 200 --no-pager"
