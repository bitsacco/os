import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Attributes, Counter, Histogram, Observable } from '@opentelemetry/api';
import { MetricsService } from './metrics.service';

// Event constants for metrics
export const CORE_DATABASE_METRIC = 'core:database';
export const CORE_API_METRIC = 'core:api';
export const CORE_GRPC_METRIC = 'core:grpc';
export const CORE_RESOURCE_METRIC = 'core:resource';

/**
 * Metrics for database operations
 */
export interface DatabaseMetric {
  operation: 'find' | 'findOne' | 'create' | 'update' | 'delete' | 'aggregate';
  collection: string;
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for API operations
 */
export interface ApiMetric {
  method: string;
  path: string;
  statusCode: number;
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for gRPC operations
 */
export interface GrpcMetric {
  service: string;
  method: string;
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for system resources
 */
export interface ResourceMetric {
  resource: 'cpu' | 'memory' | 'disk' | 'network';
  value: number;
  unit: string;
}

/**
 * Service for tracking core infrastructure metrics
 */
@Injectable()
export class CoreMetricsService extends MetricsService {
  protected readonly logger = new Logger(CoreMetricsService.name);

  // Database metrics
  private databaseOperationCounter!: Counter;
  private databaseOperationDurationHistogram!: Histogram;
  private databaseErrorCounter!: Counter;

  // API metrics
  private apiRequestCounter!: Counter;
  private apiRequestDurationHistogram!: Histogram;
  private apiErrorCounter!: Counter;
  private errorsByEndpoint!: Counter;
  private errorsByType!: Counter;
  private errorsByService!: Counter;

  // gRPC metrics
  private grpcRequestCounter!: Counter;
  private grpcRequestDurationHistogram!: Histogram;
  private grpcErrorCounter!: Counter;

  // Resource metrics
  private cpuUsageObservable!: Observable<Attributes>;
  private memoryUsageObservable!: Observable<Attributes>;
  private diskUsageObservable!: Observable<Attributes>;
  private networkRxObservable!: Observable<Attributes>;
  private networkTxObservable!: Observable<Attributes>;

  // In-memory metrics
  private metrics = {
    database: {
      operations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      byCollection: {} as Record<
        string,
        {
          total: number;
          successful: number;
          failed: number;
        }
      >,
      byOperation: {} as Record<
        string,
        {
          total: number;
          successful: number;
          failed: number;
        }
      >,
    },
    api: {
      requests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageDuration: 0,
      byMethod: {} as Record<
        string,
        {
          total: number;
          successful: number;
          failed: number;
        }
      >,
      byPath: {} as Record<
        string,
        {
          total: number;
          successful: number;
          failed: number;
        }
      >,
      byStatusCode: {} as Record<string, number>,
    },
    grpc: {
      requests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageDuration: 0,
      byService: {} as Record<
        string,
        {
          total: number;
          successful: number;
          failed: number;
        }
      >,
      byMethod: {} as Record<
        string,
        {
          total: number;
          successful: number;
          failed: number;
        }
      >,
    },
    resources: {
      cpu: {
        current: 0,
        average: 0,
        peak: 0,
      },
      memory: {
        current: 0,
        average: 0,
        peak: 0,
      },
      disk: {
        current: 0,
        average: 0,
        peak: 0,
      },
      network: {
        rx: {
          current: 0,
          average: 0,
          peak: 0,
        },
        tx: {
          current: 0,
          average: 0,
          peak: 0,
        },
      },
    },
    errors: {} as Record<string, number>,
  };

  // Current resource metrics for observable metrics
  private currentResources = {
    cpu: 0,
    memory: 0,
    disk: 0,
    networkRx: 0,
    networkTx: 0,
  };

  constructor(private eventEmitter: EventEmitter2) {
    super('core');
    this.initializeMetrics();
  }

  /**
   * Initialize core metrics
   */
  private initializeMetrics() {
    // Database metrics
    this.databaseOperationCounter = this.createCounter(
      'core.database.operations',
      {
        description: 'Number of database operations',
      },
    );

    this.databaseOperationDurationHistogram = this.createHistogram(
      'core.database.duration',
      {
        description: 'Duration of database operations',
        unit: 'ms',
      },
    );

    this.databaseErrorCounter = this.createCounter('core.database.errors', {
      description: 'Number of database errors',
    });

    // API metrics
    this.apiRequestCounter = this.createCounter('core.api.requests', {
      description: 'Number of API requests',
    });

    this.apiRequestDurationHistogram = this.createHistogram(
      'core.api.duration',
      {
        description: 'Duration of API requests',
        unit: 'ms',
      },
    );

    this.apiErrorCounter = this.createCounter('core.api.errors', {
      description: 'Number of API errors',
    });

    // Detailed error metrics
    this.errorsByEndpoint = this.createCounter(`core.errors_by_endpoint`, {
      description: 'Number of errors by endpoint path',
    });

    this.errorsByType = this.createCounter(`core.errors_by_type`, {
      description: 'Number of errors by error type/code',
    });

    this.errorsByService = this.createCounter(`core.errors_by_service`, {
      description: 'Number of errors by downstream service',
    });

    // gRPC metrics
    this.grpcRequestCounter = this.createCounter('core.grpc.requests', {
      description: 'Number of gRPC requests',
    });

    this.grpcRequestDurationHistogram = this.createHistogram(
      'core.grpc.duration',
      {
        description: 'Duration of gRPC requests',
        unit: 'ms',
      },
    );

    this.grpcErrorCounter = this.createCounter('core.grpc.errors', {
      description: 'Number of gRPC errors',
    });

    // Resource metrics
    this.cpuUsageObservable = this.createObservable(
      'core.resources.cpu_usage',
      {
        description: 'CPU usage percentage',
        unit: '%',
      },
      (observable) => {
        observable.observe(this.currentResources.cpu);
      },
    );

    this.memoryUsageObservable = this.createObservable(
      'core.resources.memory_usage',
      {
        description: 'Memory usage in megabytes',
        unit: 'MB',
      },
      (observable) => {
        observable.observe(this.currentResources.memory);
      },
    );

    this.diskUsageObservable = this.createObservable(
      'core.resources.disk_usage',
      {
        description: 'Disk usage percentage',
        unit: '%',
      },
      (observable) => {
        observable.observe(this.currentResources.disk);
      },
    );

    this.networkRxObservable = this.createObservable(
      'core.resources.network_rx',
      {
        description: 'Network receive rate in bytes per second',
        unit: 'B/s',
      },
      (observable) => {
        observable.observe(this.currentResources.networkRx);
      },
    );

    this.networkTxObservable = this.createObservable(
      'core.resources.network_tx',
      {
        description: 'Network transmit rate in bytes per second',
        unit: 'B/s',
      },
      (observable) => {
        observable.observe(this.currentResources.networkTx);
      },
    );
  }

  /**
   * Record metrics for database operations
   */
  recordDatabaseMetric(metric: DatabaseMetric): void {
    // Update in-memory metrics
    this.metrics.database.operations++;

    // Update by collection metrics
    if (!this.metrics.database.byCollection[metric.collection]) {
      this.metrics.database.byCollection[metric.collection] = {
        total: 0,
        successful: 0,
        failed: 0,
      };
    }
    this.metrics.database.byCollection[metric.collection].total++;

    // Update by operation metrics
    if (!this.metrics.database.byOperation[metric.operation]) {
      this.metrics.database.byOperation[metric.operation] = {
        total: 0,
        successful: 0,
        failed: 0,
      };
    }
    this.metrics.database.byOperation[metric.operation].total++;

    // Track success/failure
    if (metric.success) {
      this.metrics.database.successfulOperations++;
      this.metrics.database.byCollection[metric.collection].successful++;
      this.metrics.database.byOperation[metric.operation].successful++;
    } else {
      this.metrics.database.failedOperations++;
      this.metrics.database.byCollection[metric.collection].failed++;
      this.metrics.database.byOperation[metric.operation].failed++;

      if (metric.errorType) {
        this.metrics.errors[metric.errorType] =
          (this.metrics.errors[metric.errorType] || 0) + 1;
      }
    }

    // Update average duration
    this.metrics.database.averageDuration =
      (this.metrics.database.averageDuration *
        (this.metrics.database.operations - 1) +
        metric.duration) /
      this.metrics.database.operations;

    // Record to OpenTelemetry
    this.databaseOperationCounter.add(1, {
      collection: metric.collection,
      operation: metric.operation,
      success: String(metric.success),
    });

    this.databaseOperationDurationHistogram.record(metric.duration, {
      collection: metric.collection,
      operation: metric.operation,
      success: String(metric.success),
    });

    if (!metric.success && metric.errorType) {
      this.databaseErrorCounter.add(1, {
        collection: metric.collection,
        operation: metric.operation,
        errorType: metric.errorType,
      });
    }

    // Emit event for potential subscribers
    this.eventEmitter.emit(CORE_DATABASE_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record metrics for API operations
   */
  recordApiMetric(metric: ApiMetric): void {
    // Update in-memory metrics
    this.metrics.api.requests++;

    // Update by method metrics
    if (!this.metrics.api.byMethod[metric.method]) {
      this.metrics.api.byMethod[metric.method] = {
        total: 0,
        successful: 0,
        failed: 0,
      };
    }
    this.metrics.api.byMethod[metric.method].total++;

    // Update by path metrics
    if (!this.metrics.api.byPath[metric.path]) {
      this.metrics.api.byPath[metric.path] = {
        total: 0,
        successful: 0,
        failed: 0,
      };
    }
    this.metrics.api.byPath[metric.path].total++;

    // Update by status code metrics
    this.metrics.api.byStatusCode[metric.statusCode.toString()] =
      (this.metrics.api.byStatusCode[metric.statusCode.toString()] || 0) + 1;

    // Track success/failure
    if (metric.success) {
      this.metrics.api.successfulRequests++;
      this.metrics.api.byMethod[metric.method].successful++;
      this.metrics.api.byPath[metric.path].successful++;
    } else {
      this.metrics.api.failedRequests++;
      this.metrics.api.byMethod[metric.method].failed++;
      this.metrics.api.byPath[metric.path].failed++;

      if (metric.errorType) {
        this.metrics.errors[metric.errorType] =
          (this.metrics.errors[metric.errorType] || 0) + 1;
      }
    }

    // Update average duration
    this.metrics.api.averageDuration =
      (this.metrics.api.averageDuration * (this.metrics.api.requests - 1) +
        metric.duration) /
      this.metrics.api.requests;

    // Record to OpenTelemetry
    this.apiRequestCounter.add(1, {
      method: metric.method,
      path: metric.path,
      statusCode: metric.statusCode.toString(),
      success: String(metric.success),
    });

    this.apiRequestDurationHistogram.record(metric.duration, {
      method: metric.method,
      path: metric.path,
      statusCode: metric.statusCode.toString(),
      success: String(metric.success),
    });

    if (!metric.success && metric.errorType) {
      this.apiErrorCounter.add(1, {
        method: metric.method,
        path: metric.path,
        statusCode: metric.statusCode.toString(),
        errorType: metric.errorType,
      });
    }

    // Emit event for potential subscribers
    this.eventEmitter.emit(CORE_API_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record metrics for gRPC operations
   */
  recordGrpcMetric(metric: GrpcMetric): void {
    // Update in-memory metrics
    this.metrics.grpc.requests++;

    // Update by service metrics
    if (!this.metrics.grpc.byService[metric.service]) {
      this.metrics.grpc.byService[metric.service] = {
        total: 0,
        successful: 0,
        failed: 0,
      };
    }
    this.metrics.grpc.byService[metric.service].total++;

    // Update by method metrics
    if (!this.metrics.grpc.byMethod[metric.method]) {
      this.metrics.grpc.byMethod[metric.method] = {
        total: 0,
        successful: 0,
        failed: 0,
      };
    }
    this.metrics.grpc.byMethod[metric.method].total++;

    // Track success/failure
    if (metric.success) {
      this.metrics.grpc.successfulRequests++;
      this.metrics.grpc.byService[metric.service].successful++;
      this.metrics.grpc.byMethod[metric.method].successful++;
    } else {
      this.metrics.grpc.failedRequests++;
      this.metrics.grpc.byService[metric.service].failed++;
      this.metrics.grpc.byMethod[metric.method].failed++;

      if (metric.errorType) {
        this.metrics.errors[metric.errorType] =
          (this.metrics.errors[metric.errorType] || 0) + 1;
      }
    }

    // Update average duration
    this.metrics.grpc.averageDuration =
      (this.metrics.grpc.averageDuration * (this.metrics.grpc.requests - 1) +
        metric.duration) /
      this.metrics.grpc.requests;

    // Record to OpenTelemetry
    this.grpcRequestCounter.add(1, {
      service: metric.service,
      method: metric.method,
      success: String(metric.success),
    });

    this.grpcRequestDurationHistogram.record(metric.duration, {
      service: metric.service,
      method: metric.method,
      success: String(metric.success),
    });

    if (!metric.success && metric.errorType) {
      this.grpcErrorCounter.add(1, {
        service: metric.service,
        method: metric.method,
        errorType: metric.errorType,
      });
    }

    // Emit event for potential subscribers
    this.eventEmitter.emit(CORE_GRPC_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record metrics for system resources
   */
  recordResourceMetric(metric: ResourceMetric): void {
    // Update in-memory metrics
    switch (metric.resource) {
      case 'cpu':
        this.currentResources.cpu = metric.value;
        this.metrics.resources.cpu.current = metric.value;
        this.updateResourceStats(this.metrics.resources.cpu, metric.value);
        break;
      case 'memory':
        this.currentResources.memory = metric.value;
        this.metrics.resources.memory.current = metric.value;
        this.updateResourceStats(this.metrics.resources.memory, metric.value);
        break;
      case 'disk':
        this.currentResources.disk = metric.value;
        this.metrics.resources.disk.current = metric.value;
        this.updateResourceStats(this.metrics.resources.disk, metric.value);
        break;
      case 'network':
        if (metric.unit === 'rx') {
          this.currentResources.networkRx = metric.value;
          this.metrics.resources.network.rx.current = metric.value;
          this.updateResourceStats(
            this.metrics.resources.network.rx,
            metric.value,
          );
        } else if (metric.unit === 'tx') {
          this.currentResources.networkTx = metric.value;
          this.metrics.resources.network.tx.current = metric.value;
          this.updateResourceStats(
            this.metrics.resources.network.tx,
            metric.value,
          );
        }
        break;
    }

    // Emit event for potential subscribers
    this.eventEmitter.emit(CORE_RESOURCE_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Helper method to update resource stats
   */
  private updateResourceStats(
    stats: { current: number; average: number; peak: number },
    value: number,
  ): void {
    // Update peak
    if (value > stats.peak) {
      stats.peak = value;
    }

    // Update average (simple moving average)
    const updateFactor = 0.1; // Weight for new value
    stats.average = (1 - updateFactor) * stats.average + updateFactor * value;
  }

  /**
   * Get the current metrics summary
   */
  getMetrics() {
    return {
      database: {
        operations: this.metrics.database.operations,
        successful: this.metrics.database.successfulOperations,
        failed: this.metrics.database.failedOperations,
        successRate: this.calculateSuccessRate(
          this.metrics.database.successfulOperations,
          this.metrics.database.operations,
        ),
        averageDuration: this.metrics.database.averageDuration,
        byCollection: this.metrics.database.byCollection,
        byOperation: this.metrics.database.byOperation,
      },
      api: {
        requests: this.metrics.api.requests,
        successful: this.metrics.api.successfulRequests,
        failed: this.metrics.api.failedRequests,
        successRate: this.calculateSuccessRate(
          this.metrics.api.successfulRequests,
          this.metrics.api.requests,
        ),
        averageDuration: this.metrics.api.averageDuration,
        byMethod: this.metrics.api.byMethod,
        byPath: this.metrics.api.byPath,
        byStatusCode: this.metrics.api.byStatusCode,
      },
      grpc: {
        requests: this.metrics.grpc.requests,
        successful: this.metrics.grpc.successfulRequests,
        failed: this.metrics.grpc.failedRequests,
        successRate: this.calculateSuccessRate(
          this.metrics.grpc.successfulRequests,
          this.metrics.grpc.requests,
        ),
        averageDuration: this.metrics.grpc.averageDuration,
        byService: this.metrics.grpc.byService,
        byMethod: this.metrics.grpc.byMethod,
      },
      resources: this.metrics.resources,
      errors: this.metrics.errors,
    };
  }

  /**
   * Helper method to calculate success rate percentage
   */
  private calculateSuccessRate(successful: number, total: number): number {
    if (total === 0) return 0;
    return (successful / total) * 100;
  }

  /**
   * Record detailed error metrics
   *
   * @param endpoint The API endpoint that encountered the error
   * @param errorType The type or code of the error
   * @param service Optional downstream service that caused the error
   */
  recordError(endpoint: string, errorType: string, service?: string): void {
    // Record error by endpoint
    this.errorsByEndpoint.add(1, { endpoint });

    // Record error by type
    this.errorsByType.add(1, { error_type: errorType });

    // Record error by service if provided
    if (service) {
      this.errorsByService.add(1, { service });
    }

    // Update in-memory metrics
    this.metrics.errors[errorType] = (this.metrics.errors[errorType] || 0) + 1;
  }

  /**
   * Reset all metrics to zero
   */
  resetMetrics(): void {
    // Reset database metrics
    this.metrics.database.operations = 0;
    this.metrics.database.successfulOperations = 0;
    this.metrics.database.failedOperations = 0;
    this.metrics.database.averageDuration = 0;
    this.metrics.database.byCollection = {};
    this.metrics.database.byOperation = {};

    // Reset API metrics
    this.metrics.api.requests = 0;
    this.metrics.api.successfulRequests = 0;
    this.metrics.api.failedRequests = 0;
    this.metrics.api.averageDuration = 0;
    this.metrics.api.byMethod = {};
    this.metrics.api.byPath = {};
    this.metrics.api.byStatusCode = {};

    // Reset gRPC metrics
    this.metrics.grpc.requests = 0;
    this.metrics.grpc.successfulRequests = 0;
    this.metrics.grpc.failedRequests = 0;
    this.metrics.grpc.averageDuration = 0;
    this.metrics.grpc.byService = {};
    this.metrics.grpc.byMethod = {};

    // Reset resource metrics
    this.metrics.resources.cpu = {
      current: 0,
      average: 0,
      peak: 0,
    };
    this.metrics.resources.memory = {
      current: 0,
      average: 0,
      peak: 0,
    };
    this.metrics.resources.disk = {
      current: 0,
      average: 0,
      peak: 0,
    };
    this.metrics.resources.network = {
      rx: {
        current: 0,
        average: 0,
        peak: 0,
      },
      tx: {
        current: 0,
        average: 0,
        peak: 0,
      },
    };

    // Reset error types
    this.metrics.errors = {};
  }
}
