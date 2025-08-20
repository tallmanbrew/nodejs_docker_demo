# nodejs_docker_demo

Small demo Node.js app with two images:

- `nodejs-docker-demo` - normal image (no built-in OTEL instrumentation)
- `nodejs-docker-demo-otel` - image that includes OpenTelemetry Node SDK and auto-instrumentation

How OTEL is configured

The OTEL-enabled image requires setting the OTLP endpoint and optional headers via environment variables. `src/otel-bootstrap.js` supports the following:

- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` - full HTTP endpoint to send traces (preferred)
- `OTEL_EXPORTER_OTLP_ENDPOINT` - base OTLP endpoint; `v1/traces` is appended
- `OTEL_EXPORTER_OTLP_HEADERS` - comma-separated `key=value` pairs to send as headers (useful for API keys)
- `OTEL_SERVICE_NAME` - service name to appear on traces

Examples

Docker run:

```bash
# run OTEL image and send to a collector at https://otel-collector:4318 with an API key header
docker run -e OTEL_EXPORTER_OTLP_ENDPOINT="https://otel-collector:4318" \
           -e OTEL_EXPORTER_OTLP_HEADERS="api-key=ABC123" \
           -e OTEL_SERVICE_NAME="addressbook-otel" \
           -p 3001:3000 nodejs-docker-demo-otel:latest
```

Kubernetes (Deployment snippet):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: addressbook-otel
spec:
  replicas: 1
  selector:
    matchLabels:
      app: addressbook-otel
  template:
    metadata:
      labels:
        app: addressbook-otel
    spec:
      containers:
        - name: app
          image: ghcr.io/<owner>/<repo>/nodejs-docker-demo-otel:latest
          env:
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: "https://otel-collector.default.svc.cluster.local:4318"
            - name: OTEL_EXPORTER_OTLP_HEADERS
              value: "api-key=XYZ"
            - name: OTEL_SERVICE_NAME
              value: "addressbook-otel"
          ports:
            - containerPort: 3000
```

Notes

- If you already use Kubernetes auto-injection (e.g., you inject an OTEL sidecar or use a node auto-instrumentation injector), don't enable the built-in OTEL image to avoid double-instrumentation.
- The `otel-bootstrap.js` file prints the resolved endpoint and service name on startup for easy debugging.

Re-enabling in-process OpenTelemetry in the OTEL image

If you want the OTEL image to include the in-process OpenTelemetry Node SDK and exporters, add the desired @opentelemetry/* packages back into `src/package.json` and pin exact published versions. Example (recommended minimal set):

- `@opentelemetry/sdk-node`: 0.203.0
- `@opentelemetry/instrumentation-http`: 0.203.0
- `@opentelemetry/instrumentation-express`: 0.52.0
- `@opentelemetry/instrumentation-runtime-node`: 0.17.1
- `@opentelemetry/exporter-trace-otlp-http`: 0.203.0
- `@opentelemetry/exporter-prometheus`: 0.203.0

After editing `src/package.json` run a rebuild of the OTEL image:

1) cd to the repo root
2) docker build -f Dockerfile.otel -t nodejs-docker-demo-otel:latest .

If npm install fails in the Docker build step, check the exact published package versions on the npm registry and pin them (replace the example versions above). See conversation logs for troubleshooting tips.
