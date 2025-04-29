# Bitsacco Telemetry

This directory contains standardized monitoring and telemetry services for Bitsacco OS.

## Core Components

1. **OpenTelemetry Integration**
   - OpenTelemetry SDK initialization with consistent configuration
   - Supports metrics collection and future distributed tracing

2. **Bootstrapping**
   - Standardized bootstrapTelemetry function for uniform initialization
   - Graceful shutdown handling for telemetry resources

3. **Core Metrics Service**
   - Database operation metrics
   - API and gRPC request monitoring
   - Resource utilization tracking (CPU, memory, disk, network)
   - Error monitoring by type, endpoint, and service

4. **Business Metrics**
   - Transaction metrics for cross-service transaction tracking
   - Financial metrics (volume, currencies, conversion rates)
   - User engagement metrics (DAU, MAU, session duration)
   - Feature usage analytics
   - User retention metrics

## Usage

### Initializing Telemetry

In your service's main.ts file:

```typescript
import { bootstrapTelemetry } from '@bitsacco/common';

async function bootstrap() {
  // Initialize telemetry with service name and optional metrics port
  bootstrapTelemetry('service-name', 9464);
  
  // Rest of your bootstrap code
  // ...
}
```

### Using Transaction Metrics

For tracking cross-service business transactions:

```typescript
import { TransactionMetricsService, TransactionMetric } from '@bitsacco/common';

@Injectable()
export class YourService {
  constructor(private transactionMetrics: TransactionMetricsService) {}
  
  async processTransaction() {
    const startTime = Date.now();
    const transactionId = uuidv4();
    
    try {
      // Start transaction tracking
      this.transactionMetrics.recordTransactionMetric({
        transactionId,
        userId: 'user123',
        operationType: 'deposit',
        amount: 1000,
        currency: 'KES',
        startTime,
        status: 'initiated',
        involvedServices: ['swap', 'shares'],
      });
      
      // Business logic...
      
      // Complete transaction tracking
      this.transactionMetrics.recordTransactionMetric({
        transactionId,
        userId: 'user123',
        operationType: 'deposit',
        amount: 1000,
        currency: 'KES',
        startTime,
        endTime: Date.now(),
        status: 'completed',
        involvedServices: ['swap', 'shares'],
      });
      
    } catch (error) {
      // Failure tracking
      this.transactionMetrics.recordTransactionMetric({
        transactionId,
        userId: 'user123',
        operationType: 'deposit',
        amount: 1000,
        currency: 'KES',
        startTime,
        endTime: Date.now(),
        status: 'failed',
        involvedServices: ['swap', 'shares'],
        errorType: error.name,
      });
    }
  }
}
```

### Using Business Metrics

For tracking user engagement and behavior:

```typescript
import { BusinessMetricsService } from '@bitsacco/common';

@Injectable()
export class YourService {
  constructor(private businessMetrics: BusinessMetricsService) {}
  
  async trackUserActivity(userId: string) {
    // Record session metrics
    this.businessMetrics.recordUserSessionMetric({
      userId,
      sessionId: 'session123',
      duration: 300000, // 5 minutes in ms
      features: ['wallet', 'transfer', 'settings'],
      deviceType: 'mobile',
      appVersion: '1.2.3',
    });
    
    // Record feature usage
    this.businessMetrics.recordFeatureUsageMetric({
      featureId: 'transfer',
      userId,
      duration: 45000, // 45 seconds
      successful: true,
    });
    
    // Track retention
    this.businessMetrics.recordUserRetentionMetric({
      userId,
      daysSinceRegistration: 7,
      isActive: true,
      lastFeatureUsed: 'transfer',
    });
  }
}
```

## Dashboard Access

With the service docker compose running,

- Business metrics dashboards can be accessed at:
http://localhost:3010/d/bitsacco-business-metrics/bitsacco-business-metrics-dashboard

- Service health dashboard can be accessed at:
http://localhost:3010/d/bitsacco-service-health/bitsacco-service-health-dashboard
