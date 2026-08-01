#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-apologetics-backend}"
INSTALL_DEPS="${INSTALL_DEPS:-0}"
BUILD_APP="${BUILD_APP:-0}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3000/api}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-10}"
HEALTHCHECK_RETRY_DELAY="${HEALTHCHECK_RETRY_DELAY:-2}"
DRY_RUN=0
INSTALLED_DEV_DEPS=0

usage() {
  cat <<'EOF'
Usage: remote-deploy.sh [--dry-run]

Options:
  --dry-run   Print commands that would run without executing them
  BRANCH=ref  Environment override to deploy a different branch
  SERVICE_NAME=name  Override systemd service name (default: apologetics-backend)
  INSTALL_DEPS=1      Run npm ci --omit=dev before restart (default: 0)
  BUILD_APP=1         Run npm run build before restart (default: 0)
  RUN_MIGRATIONS=1    Run Prisma deploy migrations (default: 0)
  HEALTHCHECK_URL=url URL to verify after restart (default: http://127.0.0.1:3000/api)
  HEALTHCHECK_RETRIES=n  Retry count for health check after restart (default: 10)
  HEALTHCHECK_RETRY_DELAY=s  Seconds between health check attempts (default: 2)
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

run_healthcheck() {
  local curl_args=(--fail --silent --show-error --retry "$HEALTHCHECK_RETRIES" --retry-delay "$HEALTHCHECK_RETRY_DELAY" --retry-connrefused)

  if [[ -n "${API_KEY:-}" ]]; then
    curl "${curl_args[@]}" -H "x-api-key: $API_KEY" "$HEALTHCHECK_URL" >/dev/null
  else
    curl "${curl_args[@]}" "$HEALTHCHECK_URL" >/dev/null
  fi
}

echo "Deploy script starting (root: $ROOT_DIR)"
echo "Branch: $BRANCH"
echo "Service: $SERVICE_NAME"
echo "Install deps: $INSTALL_DEPS"
echo "Build app: $BUILD_APP"
echo "Run migrations: $RUN_MIGRATIONS"
echo

cd "$ROOT_DIR"

run git fetch origin
run git checkout "$BRANCH"
run git pull origin "$BRANCH"

cd "$BACKEND_DIR"

if [[ "$INSTALL_DEPS" == "1" ]]; then
  if [[ "$BUILD_APP" == "1" ]]; then
    # nest build depends on devDependencies (e.g. @nestjs/cli)
    run npm ci --no-audit --no-fund
    INSTALLED_DEV_DEPS=1
  else
    run npm ci --omit=dev --no-audit --no-fund
  fi
elif [[ "$DRY_RUN" != "1" ]]; then
  # Fail early if runtime dependencies are missing.
  if [[ ! -f "node_modules/@nestjs/core/package.json" ]]; then
    echo "Missing runtime dependencies. Re-run with INSTALL_DEPS=1"
    exit 1
  fi
fi

if [[ "$BUILD_APP" == "1" ]]; then
  if [[ "$DRY_RUN" != "1" && ! -x "node_modules/.bin/nest" ]]; then
    echo "Missing Nest CLI for build. Re-run with INSTALL_DEPS=1 BUILD_APP=1"
    exit 1
  fi
  run npm run build
fi

if [[ "$RUN_MIGRATIONS" == "1" ]]; then
  if [[ "$DRY_RUN" == "1" || -x "node_modules/.bin/prisma" ]]; then
    run npm run prisma:migrate:deploy
  else
    echo "Prisma CLI not available. Install dev dependencies or run migrations externally."
    exit 1
  fi
fi

if [[ "$INSTALLED_DEV_DEPS" == "1" ]]; then
  # Keep the runtime image lean after successful build/migrations.
  run npm prune --omit=dev --no-audit --no-fund
fi

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

if command -v curl >/dev/null 2>&1; then
  echo "Running health check: $HEALTHCHECK_URL"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "+ curl --fail --silent --show-error --retry $HEALTHCHECK_RETRIES --retry-delay $HEALTHCHECK_RETRY_DELAY --retry-connrefused $HEALTHCHECK_URL"
  else
    run_healthcheck
  fi
fi

echo "Deployment finished. Check logs if necessary: sudo journalctl -u $SERVICE_NAME -n 200 --no-pager"
