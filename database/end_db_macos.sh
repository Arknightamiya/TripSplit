#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CONTAINER_NAME="${TRIPSPLIT_DB_CONTAINER:-tripsplit-postgres}"
DATA_DIR="${TRIPSPLIT_DB_DATA_DIR:-${ROOT_DIR}/.tripsplit-postgres-data}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to manage the TripSplit DB container."
  exit 1
fi

if docker ps --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  docker stop "${CONTAINER_NAME}" >/dev/null
  echo "Stopped ${CONTAINER_NAME}."
else
  echo "${CONTAINER_NAME} is not running."
fi

if [[ "${PURGE_TRIPSPLIT_DB:-0}" == "1" ]]; then
  if docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
    docker rm "${CONTAINER_NAME}" >/dev/null
    echo "Removed ${CONTAINER_NAME}."
  fi

  rm -rf "${DATA_DIR}"
  echo "Removed ${DATA_DIR}."
else
  echo "Data is still stored in ${DATA_DIR}."
  echo "To delete all local DB data, rerun with PURGE_TRIPSPLIT_DB=1."
fi
