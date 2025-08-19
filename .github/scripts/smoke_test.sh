#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/j/Users/Chris/Documents/Git/nodejs_docker_demo"
cd "$REPO_ROOT"

# Start container
CID=$(docker run -d --rm -p 3000:3000 --name nodejs-demo nodejs-docker-demo)
if [ -z "$CID" ]; then
  echo "Failed to start container"
  docker ps -a
  exit 1
fi

echo "Started container $CID"

# wait for readiness (max 20s)
for i in {1..20}; do
  if curl -sS http://localhost:3000/ready | grep -q 'true'; then
    echo "Service ready"
    break
  fi
  echo "Waiting for service... ($i)"
  sleep 1
done

# run tests
echo "== /healthz =="
curl -sS -D - http://localhost:3000/healthz || true

echo -e "\n== /ready =="
curl -sS -D - http://localhost:3000/ready || true

echo -e "\n== GET /persons/all =="
curl -sS -D - http://localhost:3000/persons/all || true

# prepare payload in a file to avoid quoting issues
PAYLOAD_FILE=$(mktemp)
cat > "$PAYLOAD_FILE" <<'JSON'
{"firstName":"Dora","lastName":"Explorer"}
JSON

echo -e "\n== POST /persons =="
curl -sS -D - -H "Content-Type: application/json" --data-binary @"$PAYLOAD_FILE" -X POST http://localhost:3000/persons || true
rm -f "$PAYLOAD_FILE"

echo -e "\n== GET /persons/all (after POST) =="
curl -sS -D - http://localhost:3000/persons/all || true

# stop container
docker stop "$CID" >/dev/null || true

echo "Stopped container"
