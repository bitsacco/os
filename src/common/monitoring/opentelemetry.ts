import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { trace, metrics } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ATTR_DEPLOYMENT_ENVIRONMENT } from './semconv';

/**
 * Initialize OpenTelemetry for the application
 * @param serviceName Name of the service to use in metrics and tracing
 * @returns The NodeSDK instance that can be used to shut down telemetry
 */
export function initializeOpenTelemetry(serviceName: string) {
  // Optional: configure endpoint. If not provided, it will try to use the default
  // which is http://localhost:4318/v1/traces
  const otlpExporterUrl =
    process.env.OTLP_EXPORTER_URL || 'http://jaeger:4318/v1/traces';

  // Configure tracing
  // No exporter by default, we'll use OTLP HTTP when needed
  const traceExporter = new OTLPTraceExporter({
    url: otlpExporterUrl,
  });

  const env = process.env.NODE_ENV || 'development';

  const spanProcessor =
    env === 'production'
      ? new BatchSpanProcessor(traceExporter)
      : new SimpleSpanProcessor(traceExporter);

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: '1.0.0',
      [ATTR_DEPLOYMENT_ENVIRONMENT]: env,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-mongoose': { enabled: true },
        '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
      }),
    ],
    spanProcessor,
  });

  try {
    sdk.start();
    console.log(`OpenTelemetry initialized for ${serviceName}`);
  } catch (error) {
    console.error('Error initializing OpenTelemetry', error);
  }

  return sdk;
}

/**
 * Create a meter with the given name
 * @param name Name of the meter
 * @returns Meter instance
 */
export function createMeter(name: string) {
  return metrics.getMeter(name);
}

/**
 * Create a tracer with the given name
 * @param name Name of the tracer
 * @returns Tracer instance
 */
export function createTracer(name: string) {
  return trace.getTracer(name);
}

/**
 * Initialize OpenTelemetry globally with default metrics
 * This is optional and more metrics can be added as needed
 */
export function initializeDefaultMetrics(meter: any) {
  // Create some default counters for monitoring
  const httpRequestCounter = meter.createCounter('http.requests', {
    description: 'Count of HTTP requests',
  });

  const errorCounter = meter.createCounter('errors', {
    description: 'Count of errors',
  });

  const durationHistogram = meter.createHistogram('http.request.duration', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
  });

  return {
    httpRequestCounter,
    errorCounter,
    durationHistogram,
  };
}
