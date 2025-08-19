// OTEL bootstrap - starts the OpenTelemetry Node SDK
// This file should be required before the application code to enable instrumentation

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Resolve OTLP HTTP traces endpoint (preference: explicit traces endpoint -> generic endpoint -> undefined)
const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  || (process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/+$/, '')}/v1/traces`
      : undefined);

// Parse OTEL_EXPORTER_OTLP_HEADERS (format: key1=val1,key2=val2)
let headers;
if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
  try {
    headers = Object.fromEntries(
      process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',').map(kv => {
        const idx = kv.indexOf('=');
        if (idx === -1) return [kv.trim(), ''];
        const k = kv.slice(0, idx).trim();
        const v = kv.slice(idx + 1).trim();
        return [k, v];
      })
    );
  } catch (err) {
    console.warn('Failed to parse OTEL_EXPORTER_OTLP_HEADERS, ignoring:', err.message);
  }
}

// Service name/resource
const serviceName = process.env.OTEL_SERVICE_NAME || process.env.npm_package_name || 'nodejs-demo';

const traceExporter = new OTLPTraceExporter({
  url: tracesEndpoint,
  headers
});

const sdk = new NodeSDK({
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName
  })
});

sdk.start()
  .then(() => console.log(`OTEL SDK started (service=${serviceName}, endpoint=${tracesEndpoint || '<default>'})`))
  .catch((err) => console.error('Failed to start OTEL SDK', err));

// graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OTEL SDK shut down'))
    .catch(() => {});
});

process.on('SIGINT', () => {
  sdk.shutdown()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
});
