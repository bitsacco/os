# Bitsacco OS Metrics

This document describes the metrics collected by the Bitsacco OS platform and how to use them.

## Table of Contents

- [Overview](#overview)
- [Metric Types](#metric-types)
- [Naming Conventions](#naming-conventions)
- [Standard Metrics](#standard-metrics)
- [Service-Specific Metrics](#service-specific-metrics)
  - [Authentication Metrics](#authentication-metrics)
  - [LNURL Metrics](#lnurl-metrics)
  - [Swap Metrics](#swap-metrics)
  - [Shares Metrics](#shares-metrics)
  - [Core Metrics](#core-metrics)
- [Adding New Metrics](#adding-new-metrics)
- [Metric Collection and Visualization](#metric-collection-and-visualization)

## Overview

Bitsacco OS uses OpenTelemetry for metrics collection with Prometheus as the storage backend and Grafana for visualization. Metrics are federated through the API Gateway, which exposes a `/metrics` endpoint that collects metrics from all services.

## Metric Types

Bitsacco OS collects the following types of metrics:

1. **Counters**: Monotonically increasing values that track the number of occurrences of an event.
   - Examples: Number of login attempts, number of transactions, error counts.

2. **Histograms**: Record distribution of values, such as request durations or transaction amounts.
   - Examples: API request durations, transaction amounts.

3. **Gauges**: Values that can increase and decrease over time.
   - Examples: Current number of active users, current memory usage.

4. **Observables**: Lazy measurements collected only when scraped.
   - Examples: Resource utilization, exchange rates.

## Naming Conventions

Metric names follow a hierarchical structure:

```
service.entity.operation.result
```

Where:
- `service`: The microservice generating the metric (e.g., auth, swap, shares)
- `entity`: The entity being tracked (e.g., login, token, transaction)
- `operation`: The specific operation (e.g., total, success, failure)
- `result`: The outcome or aspect being measured (e.g., count, duration)

Examples:
- `auth.login.total` - Total login attempts
- `swap.onramp.amount_kes` - Distribution of onramp amounts in KES
- `core.database.duration` - Duration of database operations

## Standard Metrics

All services implement a standard set of operational metrics:

- `service.operation.total` - Total number of operations
- `service.operation.success` - Number of successful operations
- `service.operation.failure` - Number of failed operations
- `service.operation.duration` - Duration of operations in milliseconds

## Service-Specific Metrics

### Authentication Metrics

#### Login Metrics
- `auth.login.attempts` - Total login attempts
- `auth.login.successful` - Successful logins
- `auth.login.failed` - Failed logins
- `auth.login.by_type` - Login attempts by authentication type (phone, npub)
- `auth.login.by_type.duration` - Login duration by authentication type

#### Registration Metrics
- `auth.register.attempts` - Total registration attempts
- `auth.register.successful` - Successful registrations
- `auth.register.failed` - Failed registrations
- `auth.register.by_type` - Registration attempts by authentication type
- `auth.register.by_type.duration` - Registration duration by authentication type

#### Verification Metrics
- `auth.verify.attempts` - Total verification attempts
- `auth.verify.successful` - Successful verifications
- `auth.verify.failed` - Failed verifications
- `auth.verify.by_method` - Verification attempts by method (sms, nostr)
- `auth.verify.by_method.duration` - Verification duration by method

#### Token Metrics
- `auth.token.operations` - Token operations by operation type (issue, refresh, verify, revoke)
- `auth.token.issued` - Tokens issued
- `auth.token.refreshed` - Tokens refreshed
- `auth.token.verified` - Tokens verified
- `auth.token.revoked` - Tokens revoked
- `auth.token.failed` - Failed token operations
- `auth.token.operations.duration` - Token operation duration

### LNURL Metrics

#### Withdrawal Metrics
- `lnurl.withdrawal.total` - Total number of LNURL withdrawals
- `lnurl.withdrawal.success` - Successful withdrawals
- `lnurl.withdrawal.failure` - Failed withdrawals
- `lnurl.withdrawal.amount.msats` - Total amount withdrawn in millisatoshis
- `lnurl.withdrawal.amount.fiat` - Total amount withdrawn in fiat equivalent
- `lnurl.withdrawal.duration` - Duration of withdrawal operations

### Swap Metrics

#### Onramp Metrics (KES → BTC)
- `swap.onramp.count` - Number of onramp transactions
- `swap.onramp.amount_kes` - Distribution of onramp amounts in KES
- `swap.onramp.amount_sats` - Distribution of onramp amounts in satoshis
- `swap.onramp.duration` - Duration of onramp transactions

#### Offramp Metrics (BTC → KES)
- `swap.offramp.count` - Number of offramp transactions
- `swap.offramp.amount_kes` - Distribution of offramp amounts in KES
- `swap.offramp.amount_sats` - Distribution of offramp amounts in satoshis
- `swap.offramp.duration` - Duration of offramp transactions

#### Quote Metrics
- `swap.quote.count` - Number of quote requests
- `swap.quote.duration` - Duration of quote operations

#### FX Rate Metrics
- `swap.fx.update` - Number of FX rate updates
- `swap.fx.buy_rate` - Current buy rate (KES/BTC)
- `swap.fx.sell_rate` - Current sell rate (KES/BTC)

### Shares Metrics

#### Shares Transaction Metrics
- `shares.transaction.total` - Total number of share transactions
- `shares.transaction.success` - Successful share transactions
- `shares.transaction.failure` - Failed share transactions
- `shares.transaction.duration` - Duration of share transactions

#### Shares Subscription Metrics
- `shares.subscriptions.total` - Total number of share subscription attempts
- `shares.subscriptions.successful` - Successful share subscriptions
- `shares.subscriptions.failed` - Failed share subscriptions
- `shares.subscriptions.duration` - Duration of share subscription operations

#### Shares Transfer Metrics
- `shares.transfers.total` - Total number of share transfer attempts
- `shares.transfers.successful` - Successful share transfers
- `shares.transfers.failed` - Failed share transfers
- `shares.transfers.duration` - Duration of share transfer operations
- `shares.quantity` - Quantity of shares in transactions
- `shares.ownership.percentage` - Percentage of total shares owned by users

### Core Metrics

#### Database Metrics
- `core.database.operations` - Number of database operations
- `core.database.duration` - Duration of database operations
- `core.database.errors` - Number of database errors

#### API Metrics
- `core.api.requests` - Number of API requests
- `core.api.duration` - Duration of API requests
- `core.api.errors` - Number of API errors

#### gRPC Metrics
- `core.grpc.requests` - Number of gRPC requests
- `core.grpc.duration` - Duration of gRPC requests
- `core.grpc.errors` - Number of gRPC errors

#### Resource Metrics
- `core.resources.cpu_usage` - CPU usage percentage
- `core.resources.memory_usage` - Memory usage in megabytes
- `core.resources.disk_usage` - Disk usage percentage
- `core.resources.network_rx` - Network receive rate in bytes per second
- `core.resources.network_tx` - Network transmit rate in bytes per second

## Automatic Metrics Collection

Bitsacco OS provides automatic metrics collection for HTTP, gRPC, and database operations through interceptors and middleware.

### HTTP Metrics Interceptor

The `HttpMetricsInterceptor` automatically collects metrics for all HTTP requests:

```typescript
import { MetricsIntegration, CoreMetricsService } from '@bitsacco/common';

// In your main.ts bootstrap function
const app = await NestFactory.create(AppModule);
const metricsService = app.get(CoreMetricsService);

// Apply HTTP metrics interceptor
MetricsIntegration.applyHttpMetricsInterceptor(app, metricsService);
```

This interceptor captures:
- Request method and normalized path
- Response status code
- Request duration
- Error types (for failed requests)

### gRPC Metrics Interceptor

The `GrpcMetricsInterceptor` automatically collects metrics for all gRPC calls:

```typescript
import { MetricsIntegration, CoreMetricsService } from '@bitsacco/common';

// In your main.ts bootstrap function
const app = await NestFactory.create(AppModule);
const metricsService = app.get(CoreMetricsService);

// Apply gRPC metrics interceptor
MetricsIntegration.applyGrpcMetricsInterceptor(app, metricsService);
```

This interceptor captures:
- Service and method names
- Call duration
- Success/failure status
- Error types (for failed calls)

### Database Metrics Middleware

The `DatabaseMetricsMiddleware` automatically collects metrics for database operations:

```typescript
// In your module
DatabaseModule.forFeatureAsync([
  {
    name: UserDocument.name,
    useFactory: (middleware: DatabaseMetricsMiddleware) => {
      middleware.applyMiddleware(UserSchema, 'users');
      return UserSchema;
    },
    inject: [DatabaseMetricsMiddleware],
  },
]),
```

This middleware captures:
- Collection name
- Operation type (find, findOne, create, update, delete, aggregate)
- Operation duration
- Success/failure status
- Error types (for failed operations)

### Integration Helper

The `MetricsIntegration` class provides helper methods to easily apply metrics interceptors:

```typescript
import { MetricsIntegration, CoreMetricsService } from '@bitsacco/common';

// Apply all metrics interceptors
MetricsIntegration.applyAllMetricsInterceptors(app, metricsService);
```

## Adding Custom Metrics

To add custom metrics to an existing service:

1. Use the standard `MetricsService` or `OperationMetricsService` as a base class
2. Initialize your metrics in the constructor or `onModuleInit` lifecycle hook
3. Create methods to record specific metrics
4. Register your metrics service.

Example:

```typescript
@Injectable()
export class UserMetricsService extends OperationMetricsService {
  private userActivityCounter!: Counter;
  
  constructor(private eventEmitter: EventEmitter2) {
    super('users', 'activity');
    this.initializeMetrics();
  }
  
  private initializeMetrics() {
    this.userActivityCounter = this.createCounter('users.activity.count', {
      description: 'User activity count',
    });
  }
  
  recordUserActivity(userId: string, activityType: string) {
    this.userActivityCounter.add(1, { userId, activityType });
    
    this.recordOperationMetric({
      operation: activityType,
      success: true,
      duration: 0,
      labels: { userId },
    });
  }
}
```

Registration:

```typescript
@Module({
  providers: [UserMetricsService],
})
export class UsersModule {}
```

## Metric Collection and Visualization

Metrics are exposed via the `/metrics` endpoint on each service and collected by Prometheus. The Prometheus server is configured to scrape metrics from all services at regular intervals.

Grafana dashboards visualize the collected metrics with customizable panels and alerts. Default dashboards are provided for key services and can be extended for specific monitoring needs.

To access the metrics:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (default credentials: admin/admin)

### Key Performance Indicators (KPIs)

- **Operation Success Rate**: `<service>.<operation>.success / <service>.<operation>.total`
- **Operation Latency**: p95 of `<service>.<operation>.duration`
- **Error Rate**: `<service>.<operation>.failure / <service>.<operation>.total`

### Suggested Alerts

- **High Error Rate**: Alert when error rate exceeds 5% over 5 minutes
- **High Latency**: Alert when p95 latency exceeds defined thresholds
- **Resource Utilization**: Alert when CPU or memory usage exceeds thresholds