#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run TripSplit."
  exit 1
fi

export PORT="${PORT:-3000}"

echo "Starting TripSplit on http://localhost:${PORT}"
cd "${ROOT_DIR}"
exec node server/index.js
