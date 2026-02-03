/**
 * Next.js instrumentation: registers OpenTelemetry SDK (traces + logs) when enabled.
 * Set OTEL_ENABLED=true and OTEL_EXPORTER_OTLP_ENDPOINT (e.g. http://localhost:4318) to enable.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';

const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true' || Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'sandarb';

export async function register() {
  if (!OTEL_ENABLED) return;

  const sdk = new NodeSDK({
    serviceName: SERVICE_NAME,
  });

  sdk.start();
}
