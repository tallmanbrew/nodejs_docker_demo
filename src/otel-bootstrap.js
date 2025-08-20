// OTEL bootstrap - explicit instrumentation setup
// This file should be required before the application code to enable instrumentation

const { NodeSDK } = require('@opentelemetry/sdk-node');
// We intentionally avoid importing @opentelemetry/resources here and let the SDK detect resources.
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

// explicit instrumentations
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
let PgInstrumentation = null;
try {
  const pgMod = require('@opentelemetry/instrumentation-pg');
  PgInstrumentation = pgMod.PgInstrumentation || pgMod.default || pgMod;
} catch (err) {
  console.warn('Pg instrumentation not installed, skipping PgInstrumentation');
}
let SequelizeInstrumentation = null;
try {
  // Some versions export the class as a named export, others as default
  const mod = require('@opentelemetry/instrumentation-sequelize');
  SequelizeInstrumentation = mod.SequelizeInstrumentation || mod.default || mod;
} catch (err) {
  // not installed; that's fine — we'll skip it
  console.warn('Sequelize instrumentation not installed, skipping SequelizeInstrumentation');
}

let RuntimeInstrumentation = null;
try {
  const mod = require('@opentelemetry/instrumentation-runtime-node');
  RuntimeInstrumentation = mod.RuntimeInstrumentation || mod.default || mod;
} catch (err) {
  console.warn('Runtime instrumentation not installed, skipping RuntimeInstrumentation');
}

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

// Service name
const serviceName = process.env.OTEL_SERVICE_NAME || process.env.npm_package_name || 'nodejs-demo';
// Ensure the SDK's resource detection sees the intended service name via env var
process.env.OTEL_SERVICE_NAME = serviceName;

const traceExporter = new OTLPTraceExporter({
  url: tracesEndpoint,
  headers
});

// Optional Prometheus exporter (metrics)
let startPrometheusServer = null;
try {
  const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
  startPrometheusServer = (options = {}) => {
    const exporter = new PrometheusExporter(options, () => {
      console.log('Prometheus exporter started', options);
    });
    return exporter;
  };
} catch (err) {
  // package not installed; metrics will be disabled
  console.warn('Prometheus exporter not installed, metrics disabled');
}

// No explicit Resource is passed; the SDK will detect resources and the OTEL_SERVICE_NAME env var above

// Helper to create instrumentation instances robustly across versions
function createInstrumentationInstance(modOrCtor, name) {
  if (!modOrCtor) return null;
  try {
    // If it's a constructor function/class
    if (typeof modOrCtor === 'function') return new modOrCtor();
    // If module has a default constructor
    if (modOrCtor && typeof modOrCtor.default === 'function') return new modOrCtor.default();
    // If it's already an object instance with instrumentation-like methods, return as-is
    if (typeof modOrCtor === 'object') {
      // heuristic: instrumentation instances often have 'instrumentationName' or 'enable' method
      if (modOrCtor.instrumentationName || typeof modOrCtor.enable === 'function') return modOrCtor;
    }
  } catch (err) {
    console.warn(`Could not instantiate ${name}:`, err && err.message ? err.message : err);
    return null;
  }
  console.warn(`${name} export shape not recognized, skipping ${name}`);
  return null;
}

const instrumentations = [];
const httpInst = createInstrumentationInstance(HttpInstrumentation, 'HttpInstrumentation');
if (httpInst) instrumentations.push(httpInst);
const expressInst = createInstrumentationInstance(ExpressInstrumentation, 'ExpressInstrumentation');
if (expressInst) instrumentations.push(expressInst);
const pgInst = createInstrumentationInstance(PgInstrumentation, 'PgInstrumentation');
if (pgInst) instrumentations.push(pgInst);
const maybeSeq = createInstrumentationInstance(SequelizeInstrumentation, 'SequelizeInstrumentation');
if (maybeSeq) instrumentations.push(maybeSeq);
const maybeRuntime = createInstrumentationInstance(RuntimeInstrumentation, 'RuntimeInstrumentation');
if (maybeRuntime) instrumentations.push(maybeRuntime);

const sdk = new NodeSDK({
  traceExporter,
  instrumentations
});

// Start the SDK. Different SDK releases may return a Promise or undefined from start().
const _startResult = sdk.start();
if (_startResult && typeof _startResult.then === 'function') {
  _startResult
    .then(() => console.log(`OTEL SDK started (explicit instrumentations) service=${serviceName} endpoint=${tracesEndpoint || '<default>'}`))
    .catch((err) => console.error('Failed to start OTEL SDK', err));
} else {
  // Synchronous start (older/newer SDKs) — assume started if no exception thrown
  console.log(`OTEL SDK started (explicit instrumentations) service=${serviceName} endpoint=${tracesEndpoint || '<default>'} (sync)`);
}

// start prometheus exporter if available
if (startPrometheusServer) {
  try {
    // expose metrics on default 9464 or OTEL_PROMETHEUS_PORT
    const port = parseInt(process.env.OTEL_PROMETHEUS_PORT || '9464', 10);
    startPrometheusServer({ startServer: true, port });
  } catch (err) {
    console.warn('Failed to start Prometheus exporter', err && err.message ? err.message : err);
  }
}

// graceful shutdown
function safeShutdown(exitCode) {
  try {
    const _shutdownResult = sdk.shutdown && sdk.shutdown();
    if (_shutdownResult && typeof _shutdownResult.then === 'function') {
      _shutdownResult
        .then(() => {
          console.log('OTEL SDK shut down');
          if (typeof exitCode === 'number') process.exit(exitCode);
        })
        .catch((err) => {
          console.warn('Error during SDK shutdown', err && err.message ? err.message : err);
          if (typeof exitCode === 'number') process.exit(exitCode);
        });
    } else {
      console.log('OTEL SDK shut down (sync)');
      if (typeof exitCode === 'number') process.exit(exitCode);
    }
  } catch (err) {
    console.warn('Unexpected error during SDK shutdown', err && err.message ? err.message : err);
    if (typeof exitCode === 'number') process.exit(exitCode);
  }
}

process.on('SIGTERM', () => safeShutdown());
process.on('SIGINT', () => safeShutdown(0));
