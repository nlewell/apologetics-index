#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BRANCH="${BRANCH:-main}"
PM2_NAME="${PM2_NAME:-apologetics-backend}"
SYSTEMD_SERVICE="${SYSTEMD_SERVICE:-}"
INSTALL_DEPS="${INSTALL_DEPS:-0}"
BUILD_APP="${BUILD_APP:-0}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}"
DRY_RUN="${DRY_RUN:-0}"

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy-prod.sh [--dry-run]

Environment variables:
  BRANCH             Git branch to deploy (default: main)
  PM2_NAME           PM2 process name (default: apologetics-backend)
  SYSTEMD_SERVICE    Systemd service name to restart if PM2 is unavailable
  INSTALL_DEPS       Set to 1 to run npm ci --omit=dev
  BUILD_APP          Set to 1 to run npm run build
  RUN_MIGRATIONS     Set to 1 to run prisma migrate deploy
  DRY_RUN            Set to 1 to print commands without running them
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

run_cmd() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "+ $*"
  else
    "$@"
  fi
}

cd "$ROOT_DIR"
echo "Deploying repository from $ROOT_DIR"
echo "Branch: $BRANCH"

run_cmd git fetch origin
run_cmd git checkout "$BRANCH"
run_cmd git pull origin "$BRANCH"

cd "$BACKEND_DIR"

if [[ "$INSTALL_DEPS" == "1" ]]; then
  run_cmd npm ci --omit=dev --no-audit --no-fund
fi

if [[ "$BUILD_APP" == "1" ]]; then
  run_cmd npm run build
fi

if [[ "$RUN_MIGRATIONS" == "1" ]]; then
  run_cmd npm run prisma:migrate:deploy
fi

if command -v pm2 >/dev/null 2>&1; then
  echo "Restarting PM2 process '$PM2_NAME'"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "+ pm2 restart $PM2_NAME"
  else
    pm2 restart "$PM2_NAME" || pm2 start npm --name "$PM2_NAME" -- run start:prod
  fi
elif [[ -n "$SYSTEMD_SERVICE" ]]; then
  echo "Restarting systemd service '$SYSTEMD_SERVICE'"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "+ sudo systemctl restart $SYSTEMD_SERVICE"
  else
    sudo systemctl restart "$SYSTEMD_SERVICE"
  fi
else
  echo "No PM2 or systemd service configured."
  echo "To finish the deployment, restart the backend manually with:"
  echo "  cd $BACKEND_DIR && npm run start:prod"
fi

echo "Deployment completed."
