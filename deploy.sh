#!/bin/bash
# Deploy Mudah Bikin Aplikasi via Coolify API
# Usage: bash deploy.sh
set -euo pipefail

COOLIFY_URL="http://127.0.0.1:8000/api/v1"
APP_UUID="u7lwwdwxh13wfhiemg4rqfut"
TOKEN_FILE="/root/.coolify-token"

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "ERROR: token Coolify tidak ditemukan di $TOKEN_FILE" >&2
  exit 1
fi
TOKEN="$(cat "$TOKEN_FILE")"

echo "==> Trigger deploy via Coolify"
RESP="$(curl -s -m 30 -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uuid":"'$APP_UUID'","force":true}' \
  "$COOLIFY_URL/deploy")"
echo "$RESP"

DEPLOYMENT_UUID="$(echo "$RESP" | grep -o '"deployment_uuid":"[^"]*"' | cut -d'"' -f4)"
if [[ -z "$DEPLOYMENT_UUID" ]]; then
  echo "ERROR: gagal memulai deploy" >&2
  exit 1
fi
echo "==> Deployment UUID: $DEPLOYMENT_UUID"

echo "==> Menunggu selesai..."
while true; do
  sleep 15
  RESP_DEP="$(curl -s -m 15 -H "Authorization: Bearer $TOKEN" "$COOLIFY_URL/deployments/$DEPLOYMENT_UUID")"
  STATUS="$(echo "$RESP_DEP" | jq -r .status 2>/dev/null || true)"
  if [[ -z "$STATUS" || "$STATUS" == "null" ]]; then
    STATUS="$(echo "$RESP_DEP" | grep -o '"status":"[^"]*"' | tail -1 | cut -d'"' -f4)"
  fi
  echo "status: $STATUS"
  case "$STATUS" in
    *finished*|*success*) echo "==> Deploy sukses!"; exit 0 ;;
    *failed*|*error*|*cancelled*) echo "==> Deploy gagal." >&2; exit 1 ;;
  esac
done