#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${EMAIL_FORWARD_URL:-}" ]]; then
  echo "Missing EMAIL_FORWARD_URL"
  echo "Example: export EMAIL_FORWARD_URL='https://<site>.netlify.app/.netlify/functions/email-forward-parser'"
  exit 1
fi

if [[ -z "${EMAIL_INGEST_SECRET:-}" ]]; then
  echo "Missing EMAIL_INGEST_SECRET"
  echo "Example: export EMAIL_INGEST_SECRET='<secret>'"
  exit 1
fi

EMAIL_FROM="${EMAIL_FROM:-demo@cashcove.in}"
EMAIL_SUBJECT="${EMAIL_SUBJECT:-Debit alert}"
EMAIL_TEXT="${EMAIL_TEXT:-30 rs at VC Cafe for varan vati via BOB UPI category food tags lunch,pune}"
EMAIL_USER_ID="${EMAIL_USER_ID:-}"

if [[ -n "${EMAIL_USER_ID}" ]]; then
  QUERY="?dry_run=1&user_id=${EMAIL_USER_ID}"
else
  QUERY="?dry_run=1"
fi

URL="${EMAIL_FORWARD_URL}${QUERY}"

run_check() {
  local name="$1"
  local response

  echo "=== ${name} ==="
  shift
  response="$("$@")"
  echo "$response"
  if ! grep -q '"ok":true' <<< "$response"; then
    echo "Check failed: ${name}"
    exit 1
  fi
}

run_check \
  "JSON" \
  curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-cashcove-ingest-secret: ${EMAIL_INGEST_SECRET}" \
  -d "{\"from\":\"${EMAIL_FROM}\",\"subject\":\"${EMAIL_SUBJECT}\",\"text\":\"${EMAIL_TEXT}\"}"

run_check \
  "Form URL Encoded" \
  curl -sS -X POST "$URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "x-cashcove-ingest-secret: ${EMAIL_INGEST_SECRET}" \
  --data-urlencode "sender=${EMAIL_FROM}" \
  --data-urlencode "subject=${EMAIL_SUBJECT}" \
  --data-urlencode "stripped-text=${EMAIL_TEXT}"

run_check \
  "Multipart Form Data" \
  curl -sS -X POST "$URL" \
  -H "x-cashcove-ingest-secret: ${EMAIL_INGEST_SECRET}" \
  -F "from=${EMAIL_FROM}" \
  -F "subject=${EMAIL_SUBJECT}" \
  -F "stripped-text=${EMAIL_TEXT}"

echo "All email-forwarding dry-run checks passed."
