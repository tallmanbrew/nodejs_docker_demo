#!/usr/bin/env bash
set -euo pipefail

# Simple test harness: starts the app image, runs concurrent curl requests against endpoints,
# collects status codes and latencies, then stops the container.

IMAGE=${IMAGE:-nodejs-docker-demo}
PORT=${PORT:-3000}
HOST=${HOST:-localhost}
CONCURRENCY=${CONCURRENCY:-20}
REQUESTS=${REQUESTS:-200}
OUTDIR=${OUTDIR:-/tmp/nodejs_harness}

ENDPOINTS=("/" "/healthz" "/ready" "/persons/all" "/persons" "/items")

mkdir -p "$OUTDIR"
rm -f "$OUTDIR"/results.*

# Start container
CID=$(docker run -d --rm -p ${PORT}:3000 --name nodejs-harness "$IMAGE")
if [ -z "$CID" ]; then
  echo "Failed to start container"
  docker ps -a
  exit 1
fi

echo "Started container $CID (image=$IMAGE)"

# wait for readiness
for i in {1..30}; do
  if curl -sS "http://$HOST:$PORT/ready" | grep -q 'true'; then
    echo "Service ready"
    break
  fi
  echo "Waiting for service... ($i)"
  sleep 1
done

# run requests
echo "Running $REQUESTS requests with concurrency $CONCURRENCY against endpoints: ${ENDPOINTS[*]}"

# Prepare list of curl commands
CMDS_FILE=$(mktemp)
for i in $(seq 1 $REQUESTS); do
  for ep in "${ENDPOINTS[@]}"; do
    # use -w to print http_code and time_total, -o /dev/null to discard body
    echo "curl -s -o /dev/null -w '%{http_code} %{time_total}\n' http://$HOST:$PORT$ep >> $OUTDIR/results.$i" >> "$CMDS_FILE"
  done
done

# Execute with parallelism
cat "$CMDS_FILE" | xargs -I CMD -P $CONCURRENCY bash -c CMD
rm -f "$CMDS_FILE"

# Aggregate results
echo "Aggregating results in $OUTDIR"
for f in $OUTDIR/results.*; do
  cat "$f"
done > "$OUTDIR/all_results.txt"

# Summary: status code counts and basic latency stats
echo "Status code counts:"
awk '{print $1}' "$OUTDIR/all_results.txt" | sort | uniq -c | sort -rn

echo -e "\nLatency stats (seconds):"
awk '{print $2}' "$OUTDIR/all_results.txt" | awk '{sum+=$1; cnt+=1; if(min==""||$1<min)min=$1; if(max==""||$1>max)max=$1} END {print "count="cnt" avg="(sum/cnt)" min="min" max="max""}'

# cleanup
docker stop "$CID" >/dev/null || true

echo "Stopped container $CID"

echo "Results available at: $OUTDIR/all_results.txt"
