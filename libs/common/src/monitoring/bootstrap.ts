import { Logger } from '@nestjs/common';
import { initializeOpenTelemetry } from './opentelemetry';

/**
 * Bootstrap telemetry for a service with standardized initialization and shutdown
 *
 * @param serviceName The name of the service (used for metrics namespacing)
 * @param port Optional port number to expose metrics on
 * @returns The OpenTelemetry SDK instance that can be used to shut down telemetry
 */
export function bootstrapTelemetry(serviceName: string, port: number = 0) {
  const logger = new Logger('Telemetry');

  // Initialize OpenTelemetry for metrics and tracing
  const sdk = initializeOpenTelemetry(serviceName, port);

  // Register graceful shutdown handler
  process.on('SIGTERM', async () => {
    await sdk
      .shutdown()
      .then(() => logger.log(`${serviceName} telemetry shut down successfully`))
      .catch((err) =>
        logger.error(`${serviceName} telemetry shut down error: ${err}`),
      );
  });

  logger.log(`Telemetry initialized for ${serviceName}`);
  if (port > 0) {
    logger.log(`Metrics available at http://127.0.0.1:${port}/metrics`);
  }

  return sdk;
}
