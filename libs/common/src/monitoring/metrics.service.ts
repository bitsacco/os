import { Injectable, Logger } from '@nestjs/common';
import { Counter, Histogram, Meter, MetricOptions, Observable, ValueType } from '@opentelemetry/api';
import { createMeter } from './opentelemetry';

/**
 * Standard interface for all metric types
 */
export interface MetricData {
  value: number;
  labels?: Record<string, string>;
}

/**
 * Histogram-specific metric data
 */
export interface HistogramMetricData extends MetricData {
  min?: number;
  max?: number;
  sum?: number;
  count?: number;
  buckets?: Record<string, number>;
}

/**
 * Standardized metrics service to be extended by specific service metrics
 * Provides unified OpenTelemetry implementation with consistent patterns
 */
@Injectable()
export class MetricsService {
  protected readonly logger = new Logger(this.constructor.name);
  protected meter: Meter;

  // Collections to store metric instruments
  protected counters: Map<string, Counter> = new Map();
  protected histograms: Map<string, Histogram> = new Map();
  protected observables: Map<string, Observable<any>> = new Map();

  constructor(protected serviceName: string) {
    this.logger.log(`${this.constructor.name} initialized`);
    this.meter = createMeter(serviceName);
  }

  /**
   * Create a new counter metric
   * @param name Name of the counter (should follow convention: service.entity.operation.result)
   * @param options Options for the counter (description, unit, etc.)
   * @returns The created counter
   */
  protected createCounter(name: string, options: MetricOptions): Counter {
    if (this.counters.has(name)) {
      return this.counters.get(name)!;
    }

    const counter = this.meter.createCounter(name, options);
    this.counters.set(name, counter);
    return counter;
  }

  /**
   * Create a new histogram metric
   * @param name Name of the histogram (should follow convention: service.entity.operation.duration)
   * @param options Options for the histogram (description, unit, etc.)
   * @returns The created histogram
   */
  protected createHistogram(name: string, options: MetricOptions): Histogram {
    if (this.histograms.has(name)) {
      return this.histograms.get(name)!;
    }

    const histogram = this.meter.createHistogram(name, options);
    this.histograms.set(name, histogram);
    return histogram;
  }

  /**
   * Create a new observable metric
   * @param name Name of the observable
   * @param options Options for the observable
   * @param callback Callback function for the observable
   * @returns The created observable
   */
  protected createObservable<T extends ValueType>(
    name: string,
    options: MetricOptions,
    callback: (observable: Observable<T>) => void,
  ): Observable<T> {
    if (this.observables.has(name)) {
      return this.observables.get(name) as Observable<T>;
    }

    const observable = this.meter.createObservableGauge(name, options);
    this.observables.set(name, observable);
    observable.addCallback(callback);
    return observable;
  }

  /**
   * Increment a counter metric
   * @param name Name of the counter to increment
   * @param data Metric data including value and labels
   */
  protected incrementCounter(name: string, data: MetricData): void {
    const counter = this.counters.get(name);
    if (!counter) {
      this.logger.warn(`Counter "${name}" not found`);
      return;
    }

    counter.add(data.value, data.labels);
  }

  /**
   * Record a value in a histogram metric
   * @param name Name of the histogram to record to
   * @param data Metric data including value and labels
   */
  protected recordHistogram(name: string, data: MetricData): void {
    const histogram = this.histograms.get(name);
    if (!histogram) {
      this.logger.warn(`Histogram "${name}" not found`);
      return;
    }

    histogram.record(data.value, data.labels);
  }
}

/**
 * Standard interface for operation metrics
 */
export interface OperationMetric {
  operation: string;
  success: boolean;
  duration: number;
  errorType?: string;
  labels?: Record<string, string>;
}

/**
 * Default methods implementation for operation metrics
 */
export abstract class OperationMetricsService extends MetricsService {
  // Define common metric names
  protected readonly totalOperationCounter: string;
  protected readonly successfulOperationCounter: string;
  protected readonly failedOperationCounter: string;
  protected readonly operationDurationHistogram: string;

  constructor(serviceName: string, operationName: string) {
    super(serviceName);
    
    // Set standard metric names following convention
    this.totalOperationCounter = `${serviceName}.${operationName}.total`;
    this.successfulOperationCounter = `${serviceName}.${operationName}.success`;
    this.failedOperationCounter = `${serviceName}.${operationName}.failure`;
    this.operationDurationHistogram = `${serviceName}.${operationName}.duration`;

    // Initialize standard metrics
    this.createCounter(this.totalOperationCounter, {
      description: `Total number of ${operationName} operations`,
    });

    this.createCounter(this.successfulOperationCounter, {
      description: `Number of successful ${operationName} operations`,
    });

    this.createCounter(this.failedOperationCounter, {
      description: `Number of failed ${operationName} operations`,
    });

    this.createHistogram(this.operationDurationHistogram, {
      description: `Duration of ${operationName} operations in milliseconds`,
      unit: 'ms',
    });
  }

  /**
   * Record metrics for an operation
   * @param metric Operation metric data
   */
  recordOperationMetric(metric: OperationMetric): void {
    // Record total operation count
    this.incrementCounter(this.totalOperationCounter, {
      value: 1,
      labels: metric.labels,
    });

    // Record success or failure
    if (metric.success) {
      this.incrementCounter(this.successfulOperationCounter, {
        value: 1,
        labels: metric.labels,
      });
    } else {
      this.incrementCounter(this.failedOperationCounter, {
        value: 1,
        labels: {
          ...metric.labels,
          errorType: metric.errorType || 'unknown',
        },
      });
    }

    // Record operation duration
    this.recordHistogram(this.operationDurationHistogram, {
      value: metric.duration,
      labels: {
        ...metric.labels,
        success: String(metric.success),
        operation: metric.operation,
      },
    });

    // Log the operation metric
    this.logger.log(
      `Operation metric - Operation: ${metric.operation}, Success: ${
        metric.success
      }, Duration: ${metric.duration}ms${
        metric.errorType ? `, Error: ${metric.errorType}` : ''
      }`,
    );
  }
}