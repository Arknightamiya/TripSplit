#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$1"
DATABASE_URL="$2"
ENV_FILE="${ROOT_DIR}/.env"

touch "${ENV_FILE}"

if grep -q '^DATABASE_URL=' "${ENV_FILE}"; then
  tmp_file="$(mktemp)"
  sed "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" "${ENV_FILE}" > "${tmp_file}"
  mv "${tmp_file}" "${ENV_FILE}"
else
  printf '\nDATABASE_URL=%s\n' "${DATABASE_URL}" >> "${ENV_FILE}"
fi

if ! grep -q '^JWT_SECRET=' "${ENV_FILE}"; then
  printf 'JWT_SECRET=tripsplit-local-db-secret\n' >> "${ENV_FILE}"
fi

if ! grep -q '^PORT=' "${ENV_FILE}"; then
  printf 'PORT=3000\n' >> "${ENV_FILE}"
fi

if ! grep -q '^CORS_ORIGIN=' "${ENV_FILE}"; then
  printf 'CORS_ORIGIN=http://localhost:3000\n' >> "${ENV_FILE}"
fi

echo "Updated ${ENV_FILE}"
