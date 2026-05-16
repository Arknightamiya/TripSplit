#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CONTAINER_NAME="${TRIPSPLIT_DB_CONTAINER:-tripsplit-postgres}"
POSTGRES_IMAGE="${TRIPSPLIT_POSTGRES_IMAGE:-postgres:16}"
POSTGRES_DB="${POSTGRES_DB:-tripsplit}"
POSTGRES_USER="${POSTGRES_USER:-tripsplit_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-12345678}"
HOST_PORT="${TRIPSPLIT_DB_PORT:-5432}"
BIND_HOST="${TRIPSPLIT_DB_BIND_HOST:-127.0.0.1}"
DATA_DIR="${TRIPSPLIT_DB_DATA_DIR:-${ROOT_DIR}/.tripsplit-postgres-data}"
CLIENT_HOST="${TRIPSPLIT_DB_CLIENT_HOST:-localhost}"
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${CLIENT_HOST}:${HOST_PORT}/${POSTGRES_DB}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Engine, then rerun this script."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running or your user cannot access it."
  exit 1
fi

mkdir -p "${DATA_DIR}"

if docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  if ! docker ps --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
    docker start "${CONTAINER_NAME}" >/dev/null
  fi
else
  docker run \
    --name "${CONTAINER_NAME}" \
    -e POSTGRES_DB="${POSTGRES_DB}" \
    -e POSTGRES_USER="${POSTGRES_USER}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    -p "${BIND_HOST}:${HOST_PORT}:5432" \
    -v "${DATA_DIR}:/var/lib/postgresql/data" \
    -d "${POSTGRES_IMAGE}" >/dev/null
fi

echo "Waiting for PostgreSQL to accept connections..."
until docker exec "${CONTAINER_NAME}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; do
  sleep 1
done

"${SCRIPT_DIR}/write_local_env.sh" "${ROOT_DIR}" "${DATABASE_URL}"

(
  cd "${ROOT_DIR}"
  DATABASE_URL="${DATABASE_URL}" npm run db:schema
)

"${SCRIPT_DIR}/seed_demo_data.sh" "${ROOT_DIR}" "${CONTAINER_NAME}" "${POSTGRES_USER}" "${POSTGRES_DB}"

echo "TripSplit PostgreSQL is running at ${DATABASE_URL}"
echo "For a Mac client over SSH, prefer: ssh -L 5433:localhost:${HOST_PORT} your_user@server"
