import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { metrics, trace } from '@opentelemetry/api';

/**
 * Initialize OpenTelemetry for the application
 * @param serviceName Name of the service to use in metrics and tracing
 * @param port Port to expose Prometheus metrics on
 * @returns The NodeSDK instance that can be used to shut down telemetry
 */
export function initializeOpenTelemetry(serviceName: string, port = 9464) {
  // Create Prometheus exporter
  const prometheusExporter = new PrometheusExporter({
    port,
    // Additional configuration as needed
  });

  // Configure tracing - no exporter by default, we'll use OTLP HTTP when needed
  const traceExporter = new OTLPTraceExporter({
    // Optional: configure endpoint. If not provided, it will try to use the default
    // which is http://localhost:4318/v1/traces
    url: process.env.OTLP_EXPORTER_URL || 'http://jaeger:4318/v1/traces',
  });

  // Create and register SDK
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 
        process.env.NODE_ENV || 'development',
    }),
    // Add auto-instrumentation for common libraries
    instrumentations: [
      getNodeAutoInstrumentations({
        // These are examples of libraries that will be auto-instrumented
        '@nestjs/core': { enabled: true },
        '@grpc/grpc-js': { enabled: true },
        'mongoose': { enabled: true },
        'http': { enabled: true },
      }),
    ],
    metricReader: prometheusExporter,
    spanProcessor: traceExporter && sdk.traceProvider.getActiveSpanProcessor(),
  });

  // Start SDK
  sdk.start()
    .then(() => console.log('OpenTelemetry initialized'))
    .catch(error => console.error('Error initializing OpenTelemetry', error));

  // Return the SDK instance so it can be shut down when needed
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