import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '@bitsacco/common';

export interface ApiKeyMetric {
  success: boolean;
  operation: 'create' | 'validate' | 'revoke';
  ownerId?: string;
  duration: number;
  errorType?: string;
}

@Injectable()
export class ApiKeyMetricsService extends MetricsService {
  protected override readonly logger = new Logger(ApiKeyMetricsService.name);
  
  // Counter and histogram names
  private readonly OPERATIONS_COUNTER = 'apikey.operations.total';
  private readonly OPERATIONS_DURATION = 'apikey.operations.duration';
  private readonly ACTIVE_KEYS_GAUGE = 'apikey.active.count';

  constructor() {
    super('api-key-service');
    
    // Create metrics
    this.createCounter(this.OPERATIONS_COUNTER, {
      description: 'Total number of API key operations',
      unit: '1',
    });
    
    this.createHistogram(this.OPERATIONS_DURATION, {
      description: 'Duration of API key operations in seconds',
      unit: 's',
    });
    
    this.createObservable(
      this.ACTIVE_KEYS_GAUGE,
      {
        description: 'Number of active API keys',
        unit: '1',
      },
      (observer) => {
        // This would typically fetch the current count from database
        // For now we're just using the last reported value
        observer.observe(this._activeKeyCount);
      },
    );
    
    this.logger.log('API Key metrics initialized');
  }
  
  // Store active key count for the observable
  private _activeKeyCount = 0;

  recordApiKeyOperation(metric: ApiKeyMetric): void {
    // Create labels
    const labels = {
      operation: metric.operation,
      success: metric.success.toString(),
      ...(metric.errorType ? { error_type: metric.errorType } : { error_type: 'none' }),
    };
    
    // Increment counter
    this.incrementCounter(this.OPERATIONS_COUNTER, {
      value: 1,
      labels,
    });
    
    // Record duration
    this.recordHistogram(this.OPERATIONS_DURATION, {
      value: metric.duration / 1000, // convert to seconds
      labels: {
        operation: metric.operation,
        success: metric.success.toString(),
      },
    });
  }

  setActiveApiKeyCount(count: number): void {
    this._activeKeyCount = count;
    // The actual gauge update happens in the observable callback
  }
}