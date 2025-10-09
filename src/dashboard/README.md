# Dashboard Module

This module provides comprehensive dashboard API endpoints for the Bitsacco SACCO admin interface. It aggregates metrics from various services and provides both REST API endpoints and real-time updates via Server-Sent Events and WebSocket connections.

## Features

- **REST API Endpoints**: Full CRUD operations for dashboard data
- **Real-time Updates**: Server-Sent Events and WebSocket support
- **Metrics Aggregation**: Consolidates data from 10+ metrics services
- **Caching**: Redis-based caching with configurable TTL
- **Authentication**: JWT-based auth with role-based access control
- **Error Handling**: Graceful degradation and comprehensive error handling
- **Export Functionality**: CSV, Excel, PDF, and JSON export capabilities

## API Endpoints

### Core Dashboard Endpoints

- `GET /dashboard/overview` - Overall SACCO metrics and KPIs
- `GET /dashboard/users` - User engagement and analytics
- `GET /dashboard/financial` - Financial operations and transactions
- `GET /dashboard/operations` - System health and operational metrics

### Real-time Endpoints

- `GET /dashboard/live-stream` - Server-Sent Events for live updates
- `WebSocket /dashboard` - Bidirectional real-time communication

### Advanced Features

- `GET /dashboard/analytics/custom` - Custom date range analytics
- `POST /dashboard/export` - Export dashboard data
- `GET /dashboard/export/:id/status` - Check export status
- `GET /dashboard/export/:id/download` - Download exported data

## Architecture

### Service Structure

```
DashboardModule
├── DashboardController     # REST API endpoints
├── DashboardService       # Business logic and data aggregation
├── DashboardGateway       # WebSocket real-time features
└── Tests                  # Comprehensive unit tests
```

### Data Flow

```
External Metrics Services → DashboardService → Aggregation → Cache → API Response
                                    ↓
                           Real-time Updates → WebSocket/SSE → Client
```

### Metrics Sources

The dashboard aggregates data from these services:

1. **BusinessMetricsService** - User engagement, retention, feature usage
2. **SharesMetricsService** - Shares trading and ownership
3. **ChamaMetricsService** - Group operations and financials
4. **TransactionMetricsService** - Payment processing metrics
5. **SwapMetricsService** - Currency exchange operations
6. **SoloWalletMetricsService** - Individual wallet operations
7. **NotificationMetricsService** - Notification delivery
8. **NostrMetricsService** - Nostr protocol operations
9. **LnurlMetricsService** - Lightning Network operations
10. **AuthMetricsService** - Authentication and security

## Configuration

### Environment Variables

```bash
# Caching (optional, uses in-memory cache if not configured)
REDIS_URL=redis://localhost:6379

# Dashboard-specific settings
DASHBOARD_CACHE_TTL=300  # 5 minutes default
DASHBOARD_MAX_EXPORT_SIZE=10000  # Maximum rows for exports

# Real-time updates
DASHBOARD_LIVE_UPDATE_INTERVAL=5000  # 5 seconds
DASHBOARD_WEBSOCKET_TIMEOUT=60000    # 1 minute
```

### Caching Strategy

Different endpoints have different cache TTL values:

- Overview: 5 minutes (300s)
- Users: 10 minutes (600s)
- Financial: 3 minutes (180s)
- Operations: 1 minute (60s)
- Live metrics: No caching

## Authentication & Authorization

### Required Roles

All dashboard endpoints require authentication and specific roles:

- **admin**: Access to all dashboard data
- **super-admin**: Full access including export functionality

### JWT Requirements

```typescript
{
  "sub": "user_id",
  "roles": ["admin"],
  "iat": 1234567890,
  "exp": 1234567890
}
```

## Real-time Features

### Server-Sent Events

```javascript
// Connect to live metrics stream
const eventSource = new EventSource('/dashboard/live-stream');

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Live metrics:', data.metrics);
};
```

### WebSocket Connection

```javascript
// Connect to dashboard WebSocket
const socket = io('/dashboard');

// Subscribe to specific metrics
socket.emit('subscribe-metrics', {
  metrics: ['live', 'transactions', 'users']
});

// Listen for live updates
socket.on('live-metrics-update', (data) => {
  console.log('Live update:', data);
});

// Request fresh data
socket.emit('request-refresh', { endpoint: 'overview' });
socket.on('data-refreshed', (data) => {
  console.log('Fresh data:', data);
});
```

## Error Handling

### Response Format

All endpoints return a consistent response format:

```typescript
{
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
  timestamp: string;
  meta?: {
    cached: boolean;
    cacheAge: number;
    dataSource: 'realtime' | 'aggregated' | 'cached';
  };
}
```

### Graceful Degradation

The dashboard implements multiple fallback strategies:

1. **Service Unavailable**: Returns mock/cached data with warnings
2. **Partial Data**: Continues with available services, marks missing data
3. **Cache Failures**: Falls back to direct service calls
4. **Real-time Failures**: Gracefully degrades to polling

## Export Features

### Supported Formats

- **CSV**: Comma-separated values for spreadsheet import
- **Excel**: Native .xlsx format with formatting
- **PDF**: Formatted reports with charts (if enabled)
- **JSON**: Raw data for programmatic access

### Export Process

1. Submit export request with format and filters
2. Receive export ID and estimated completion time
3. Poll export status endpoint
4. Download completed export file

```typescript
// Request export
const response = await fetch('/dashboard/export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    format: 'csv',
    dataType: 'overview',
    dateRange: {
      start: '2024-01-01',
      end: '2024-01-31'
    }
  })
});

const { exportId } = await response.json();

// Check status
const statusResponse = await fetch(`/dashboard/export/${exportId}/status`);
const status = await statusResponse.json();

if (status.data.status === 'completed') {
  // Download file
  window.location.href = `/dashboard/export/${exportId}/download`;
}
```

## Performance Considerations

### Optimization Strategies

1. **Caching**: Redis-based caching with intelligent TTL
2. **Data Aggregation**: Pre-calculated metrics where possible
3. **Lazy Loading**: Load expensive calculations on demand
4. **Connection Pooling**: Efficient database connections
5. **Response Compression**: Gzip compression for large responses

### Monitoring

The dashboard includes built-in performance monitoring:

- Response time tracking
- Cache hit/miss ratios
- Error rate monitoring
- Resource utilization metrics

## Testing

### Unit Tests

```bash
# Run dashboard service tests
npm test dashboard.service.spec.ts

# Run dashboard controller tests
npm test dashboard.controller.spec.ts

# Run all dashboard tests
npm test -- --testPathPattern=dashboard
```

### Integration Tests

```bash
# Run E2E dashboard tests
npm run test:e2e -- --testNamePattern=dashboard
```

### Test Coverage

The dashboard module maintains >90% test coverage across:

- Service logic and data aggregation
- Controller endpoints and error handling
- WebSocket functionality
- Authentication and authorization
- Export functionality

## Development

### Adding New Metrics

1. Create or update the relevant metrics service
2. Add data aggregation logic to `DashboardService`
3. Update the response interfaces
4. Add corresponding tests
5. Update API documentation

### Adding New Endpoints

1. Add endpoint to `DashboardController`
2. Implement business logic in `DashboardService`
3. Add proper authentication guards
4. Configure caching if appropriate
5. Add comprehensive tests
6. Update OpenAPI documentation

### Performance Testing

```bash
# Load test dashboard endpoints
npm run test:load -- --config dashboard-load-test.config.js

# Memory usage profiling
npm run test:memory -- dashboard
```

## Security

### Security Measures

1. **Authentication**: JWT-based with role validation
2. **Rate Limiting**: Per-user and global rate limits
3. **Input Validation**: All inputs validated and sanitized
4. **Output Sanitization**: Prevents XSS in responses
5. **CORS Configuration**: Strict origin validation
6. **Request Logging**: Comprehensive audit trail

### Data Privacy

- No sensitive user data in logs
- Aggregated metrics only (no individual user data)
- Secure export file handling
- Automatic data retention policies

## Deployment

### Production Checklist

- [ ] Configure Redis for caching
- [ ] Set appropriate rate limits
- [ ] Configure CORS origins
- [ ] Enable request logging
- [ ] Set up monitoring alerts
- [ ] Configure backup strategies
- [ ] Test real-time functionality
- [ ] Verify export capabilities

### Monitoring & Alerts

Recommended monitoring:

- API response times (<300ms target)
- Error rates (<1% target)
- Cache hit rates (>80% target)
- WebSocket connection health
- Export processing times

## Troubleshooting

### Common Issues

1. **High Response Times**: Check cache configuration and database performance
2. **Real-time Disconnections**: Verify WebSocket proxy configuration
3. **Export Failures**: Check available disk space and memory limits
4. **Cache Issues**: Verify Redis connectivity and configuration
5. **Authentication Errors**: Check JWT secret and role configuration

### Debug Mode

Enable debug logging:

```bash
NODE_ENV=development DEBUG=dashboard:* npm start
```

### Health Checks

Monitor dashboard health:

```bash
curl http://localhost:4000/dashboard/operations
```

## API Documentation

Full API documentation is available via Swagger UI when the application is running:

```
http://localhost:4000/docs
```

The dashboard endpoints are tagged as "Dashboard" in the API documentation.
