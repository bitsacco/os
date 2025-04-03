# Bitsacco Metrics and Monitoring Guide

This document provides a comprehensive guide to the metrics collected across Bitsacco services, their meanings, and how to use them for monitoring and alerting.

## Metrics Naming Convention

Metrics in Bitsacco follow a standardized naming convention:

```
<service>.<entity>.<operation>.<result>
```

Example: `shares.subscription.total` represents the total count of share subscriptions.

## Standard Metric Types

- **Counters**: Used for values that only increase (e.g., request count, error count)
- **Histograms**: Used for measuring distributions of values (e.g., duration, size)
- **Gauges**: Used for values that can increase and decrease (e.g., current connections)

## Core Service Metrics

### LNURL Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `lnurl.withdrawal.total` | Counter | Total number of LNURL withdrawal attempts | - |
| `lnurl.withdrawal.success` | Counter | Number of successful LNURL withdrawals | - |
| `lnurl.withdrawal.failure` | Counter | Number of failed LNURL withdrawals | `errorType` |
| `lnurl.withdrawal.duration` | Histogram | Duration of LNURL withdrawal operations in milliseconds | `success`, `operation` |
| `lnurl.withdrawal.amount.msats` | Counter | Total amount withdrawn in millisatoshis | - |
| `lnurl.withdrawal.amount.fiat` | Counter | Total amount withdrawn in fiat currency (KES) | - |
| `lnurl.withdrawal.amount` | Histogram | Distribution of withdrawal amounts in millisatoshis | - |

### Shares Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `shares.subscriptions.total` | Counter | Total number of share subscription attempts | `userId`, `offerId` |
| `shares.subscriptions.successful` | Counter | Number of successful share subscriptions | `userId`, `offerId` |
| `shares.subscriptions.failed` | Counter | Number of failed share subscriptions | `userId`, `offerId`, `errorType` |
| `shares.subscriptions.duration` | Histogram | Duration of share subscription operations in milliseconds | `userId`, `offerId`, `success` |
| `shares.transfers.total` | Counter | Total number of share transfer attempts | `fromUserId`, `toUserId` |
| `shares.transfers.successful` | Counter | Number of successful share transfers | `fromUserId`, `toUserId` |
| `shares.transfers.failed` | Counter | Number of failed share transfers | `fromUserId`, `toUserId`, `errorType` |
| `shares.transfers.duration` | Histogram | Duration of share transfer operations in milliseconds | `fromUserId`, `toUserId`, `success` |
| `shares.quantity` | Histogram | Quantity of shares in transactions | `operation`, `userId`, `offerId` |
| `shares.ownership.percentage` | Histogram | Percentage of total shares owned by users | `userId`, `quantity` |
| `shares.ownership.limit_warnings` | Counter | Number of times users have attempted to exceed ownership limits | `userId` |

## Infrastructure Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `api_gateway.requests_total` | Counter | Total number of requests processed by the API gateway | `method`, `path`, `status` |
| `api_gateway.errors_total` | Counter | Total number of errors encountered by the API gateway | `method`, `path`, `error` |
| `http.requests` | Counter | Count of HTTP requests | `service` |
| `errors` | Counter | Count of errors | `service`, `type` |
| `http.request.duration` | Histogram | HTTP request duration in milliseconds | `service`, `method`, `path` |

## Using Metrics for Monitoring

### Grafana Dashboards

Grafana dashboards are available for visualizing metrics:

- **Shares Dashboard**: `/grafana/dashboards/shares-dashboard.json`
- **API Gateway Dashboard**: (coming soon)
- **System Dashboard**: (coming soon)

### Key Performance Indicators (KPIs)

- **Operation Success Rate**: `<service>.<operation>.success / <service>.<operation>.total`
- **Operation Latency**: p95 of `<service>.<operation>.duration`
- **Error Rate**: `<service>.<operation>.failure / <service>.<operation>.total`

### Suggested Alerts

- **High Error Rate**: Alert when error rate exceeds 5% over 5 minutes
- **High Latency**: Alert when p95 latency exceeds defined thresholds
- **Ownership Limits**: Alert when users approach the 20% ownership limit

## Adding New Metrics

To add new metrics to a service:

1. Extend the `OperationMetricsService` class
2. Initialize standard metrics in the constructor
3. Add custom metrics as needed
4. Update this documentation with new metrics

Example:

```typescript
@Injectable()
export class MyServiceMetrics extends OperationMetricsService {
  constructor() {
    super('myservice', 'operation');
    
    // Add custom metrics
    this.createCounter('myservice.custom.metric', {
      description: 'Custom metric description',
    });
  }
  
  // Add custom methods for recording metrics
}
```

## Troubleshooting

- **Missing Metrics**: Ensure service is properly initializing OpenTelemetry
- **No Data in Grafana**: Check Prometheus targets are up and being scraped
- **Inconsistent Labels**: Ensure consistent labeling across metric calls