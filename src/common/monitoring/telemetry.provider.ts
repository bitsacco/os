import { Global, Module, OnModuleDestroy, Injectable } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Meter, metrics } from '@opentelemetry/api';
import * as promClient from 'prom-client';

@Injectable()
export class TelemetryProvider implements OnModuleDestroy {
  private sdk: NodeSDK | null = null;
  private meters: Map<string, Meter> = new Map();
  private initialized = false;

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    if (this.initialized) {
      return;
    }

    // Initialize default Prometheus metrics
    try {
      promClient.collectDefaultMetrics({
        prefix: 'bitsacco_os_',
        register: promClient.register,
      });
      this.initialized = true;
    } catch (error) {
      // Handle initialization errors (e.g., in test environments)
      console.warn('Failed to initialize Prometheus metrics:', error);
    }
  }

  /**
   * Set the OpenTelemetry SDK instance (called from main.ts)
   */
  setSdk(sdk: NodeSDK) {
    this.sdk = sdk;
  }

  /**
   * Get or create a meter for a specific service/module
   */
  getMeter(name: string): Meter {
    if (!this.meters.has(name)) {
      const meter = metrics.getMeter(name);
      this.meters.set(name, meter);
    }
    return this.meters.get(name)!;
  }

  /**
   * Clean up on module destroy
   */
  async onModuleDestroy() {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
    // Clear the registry for tests
    if (process.env.NODE_ENV === 'test') {
      promClient.register.clear();
    }
  }
}

/**
 * Factory function to create a singleton TelemetryProvider
 * This is only used in main.ts for global telemetry initialization
 */
let globalTelemetryProvider: TelemetryProvider | null = null;

export function getGlobalTelemetryProvider(): TelemetryProvider {
  if (!globalTelemetryProvider) {
    globalTelemetryProvider = new TelemetryProvider();
  }
  return globalTelemetryProvider;
}

/**
 * Global telemetry module that provides TelemetryProvider to all modules
 */
@Global()
@Module({
  providers: [TelemetryProvider],
  exports: [TelemetryProvider],
})
export class TelemetryModule {}
