#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="${E2E_DOCKER_PROJECT_NAME:-crash-game-e2e}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
SERVICES=(
  postgres
  rabbitmq
  keycloak
  kong
  games
  wallets
)

cleanup() {
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

cleanup

docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d --wait "${SERVICES[@]}"

sleep 3

export E2E_KONG_BASE_URL="${E2E_KONG_BASE_URL:-http://localhost:8000}"
export E2E_KEYCLOAK_BASE_URL="${E2E_KEYCLOAK_BASE_URL:-http://localhost:8080}"

echo "Running games e2e tests..."
cd "$ROOT_DIR/services/games"
bun test tests/e2e
