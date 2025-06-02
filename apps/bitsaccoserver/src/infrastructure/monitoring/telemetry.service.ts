import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

@Injectable()
export class TelemetryService implements OnModuleInit {
  private readonly logger = new Logger(TelemetryService.name);
  private sdk: NodeSDK;
  private meterProvider: MeterProvider;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeTelemetry();
  }

  private initializeTelemetry() {
    const serviceName = 'bitsaccoserver';
    const serviceVersion = this.configService.get('APP_VERSION', '1.0.0');
    const environment = this.configService.get('NODE_ENV', 'development');

    // Create resource
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
    });

    // Initialize Prometheus exporter
    const prometheusExporter = new PrometheusExporter({
      port: 9090,
      endpoint: '/metrics',
    });

    // Initialize meter provider
    this.meterProvider = new MeterProvider({
      resource,
    });

    // Initialize SDK
    this.sdk = new NodeSDK({
      resource,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable filesystem instrumentation for performance
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            requestHook: (span, request) => {
              if ('headers' in request) {
                span.setAttributes({
                  'http.request.header.user-agent': request.headers['user-agent'],
                  'http.request.header.x-forwarded-for':
                    request.headers['x-forwarded-for'],
                });
              }
            },
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-mongoose': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: true,
          },
        }),
      ],
      metricReader: prometheusExporter,
    });

    // Start SDK
    this.sdk.start();

    this.logger.log('🔍 OpenTelemetry initialized successfully');
  }

  // Create custom spans for business operations
  async executeWithSpan<T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const tracer = trace.getTracer('bitsaccoserver');
    const span = tracer.startSpan(operationName, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'service.name': 'bitsaccoserver',
        ...attributes,
      },
    });

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await operation();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  // Record custom events
  recordEvent(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ) {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  // Add attributes to current span
  setSpanAttributes(attributes: Record<string, string | number | boolean>) {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  // Create meter for custom metrics
  createMeter(name: string, version?: string) {
    return this.meterProvider.getMeter(name, version);
  }

  // Graceful shutdown
  async shutdown() {
    try {
      await this.sdk.shutdown();
      this.logger.log('OpenTelemetry SDK shut down successfully');
    } catch (error) {
      this.logger.error('Error shutting down OpenTelemetry SDK', error);
    }
  }
}
