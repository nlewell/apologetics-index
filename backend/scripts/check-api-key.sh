#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000/api/index-items?limit=1}"

if [[ ! -f .env ]]; then
  echo "ERROR: .env file not found in backend directory"
  exit 1
fi

set -a
source .env
set +a

if [[ -z "${API_KEY:-}" ]]; then
  echo "ERROR: API_KEY is missing in .env"
  exit 1
fi

no_key_status="$(curl -sS -o /tmp/api_no_key_body.txt -w "%{http_code}" "$BASE_URL" || true)"
with_key_status="$(curl -sS -o /tmp/api_with_key_body.txt -w "%{http_code}" -H "x-api-key: ${API_KEY}" "$BASE_URL" || true)"

echo "NO_KEY_STATUS=${no_key_status}"
echo "WITH_KEY_STATUS=${with_key_status}"

if [[ "$no_key_status" != "401" ]]; then
  echo "ERROR: expected NO_KEY_STATUS=401"
  head -c 240 /tmp/api_no_key_body.txt || true
  echo
  exit 1
fi

if [[ "$with_key_status" != "200" ]]; then
  echo "ERROR: expected WITH_KEY_STATUS=200"
  head -c 240 /tmp/api_with_key_body.txt || true
  echo
  exit 1
fi

echo "Auth guard check passed"
