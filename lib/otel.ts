/**
 * OpenTelemetry: tracer and logger for Sandarb.
 * When OTEL is not enabled, no-op implementations are used (from the API).
 */

import { trace, context, type Span, type SpanOptions } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'sandarb';
const VERSION = '0.1.0';

const tracer = trace.getTracer(SERVICE_NAME, VERSION);
const otelLogger = logs.getLogger(SERVICE_NAME, VERSION);

/** Get the global tracer (no-op when OTEL not enabled). */
export function getTracer() {
  return tracer;
}

/** Get the OTel Logger (no-op when no LoggerProvider registered). */
export function getOtelLogger() {
  return otelLogger;
}

/** Start a span, run fn, end span. Returns fn result. */
export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T>, options?: SpanOptions): Promise<T> {
  return tracer.startActiveSpan(name, options ?? {}, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (err) {
      span.setStatus({ code: 2, message: err instanceof Error ? err.message : String(err) }); // ERROR
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      span.end();
    }
  });
}

/** Emit a log record (OTel Logs API). Correlates with active span when present. */
function emitLog(severityNumber: SeverityNumber, severityText: string, message: string, attributes?: Record<string, string | number | boolean>) {
  const ctx = context.active();
  otelLogger.emit({
    severityNumber,
    severityText,
    body: message,
    context: ctx,
    attributes: attributes ? { ...attributes } : undefined,
  });
}

/** Application logger: use in API routes and lib. Logs go to OTel when enabled. */
export const logger = {
  info(message: string, attributes?: Record<string, string | number | boolean>) {
    emitLog(SeverityNumber.INFO, 'INFO', message, attributes);
  },
  warn(message: string, attributes?: Record<string, string | number | boolean>) {
    emitLog(SeverityNumber.WARN, 'WARN', message, attributes);
  },
  error(message: string, attributes?: Record<string, string | number | boolean>) {
    emitLog(SeverityNumber.ERROR, 'ERROR', message, attributes);
  },
  debug(message: string, attributes?: Record<string, string | number | boolean>) {
    emitLog(SeverityNumber.DEBUG, 'DEBUG', message, attributes);
  },
};
