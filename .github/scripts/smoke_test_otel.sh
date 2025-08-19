#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/j/Users/Chris/Documents/Git/nodejs_docker_demo"
cd "$REPO_ROOT"

IMAGE=nodejs-docker-demo-otel

# Build OTEL image
docker build -f Dockerfile.otel -t "$IMAGE" .

# Run container
CID=$(docker run -d --rm -p 3001:3000 --name nodejs-demo-otel "$IMAGE")
if [ -z "$CID" ]; then
  echo "Failed to start OTEL container"
  docker ps -a
  exit 1
fi

echo "Started OTEL container $CID"

# wait for readiness (max 20s)
for i in {1..20}; do
  if curl -sS http://localhost:3001/ready | grep -q 'true'; then
    echo "OTEL Service ready"
    break
  fi
  echo "Waiting for OTEL service... ($i)"
  sleep 1
done

# run tests
echo "== /healthz =="
curl -sS -D - http://localhost:3001/healthz || true

echo -e "\n== /ready =="
curl -sS -D - http://localhost:3001/ready || true

echo -e "\n== GET /persons/all =="
curl -sS -D - http://localhost:3001/persons/all || true

# POST person payload
PAYLOAD_FILE=$(mktemp)
cat > "$PAYLOAD_FILE" <<'JSON'
{"firstName":"Otto","lastName":"Tracer"}
JSON

echo -e "\n== POST /persons =="
curl -sS -D - -H "Content-Type: application/json" --data-binary @"$PAYLOAD_FILE" -X POST http://localhost:3001/persons || true
rm -f "$PAYLOAD_FILE"

echo -e "\n== GET /persons/all (after POST) =="
curl -sS -D - http://localhost:3001/persons/all || true

echo -e "\n== GET /admin/status =="
curl -sS -D - http://localhost:3001/admin/status || true

echo -e "\n== GET /admin/config =="
curl -sS -D - http://localhost:3001/admin/config || true

echo -e "\n== GET /items =="
curl -sS -D - http://localhost:3001/items || true

echo -e "\n== POST /items =="
PAYLOAD_FILE=$(mktemp)
cat > "$PAYLOAD_FILE" <<'JSON'
{"name":"Tracker"}
JSON
curl -sS -D - -H "Content-Type: application/json" --data-binary @"$PAYLOAD_FILE" -X POST http://localhost:3001/items || true
rm -f "$PAYLOAD_FILE"

echo -e "\n== GET /items (after POST) =="
curl -sS -D - http://localhost:3001/items || true

# stop container
docker stop "$CID" >/dev/null || true

echo "Stopped OTEL container"
