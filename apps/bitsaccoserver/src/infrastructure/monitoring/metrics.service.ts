import { Injectable } from '@nestjs/common';
import {
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class MetricsService {
  // HTTP metrics
  private readonly httpRequestsTotal = new Counter({
    name: 'bitsacco_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [register],
  });

  private readonly httpRequestDuration = new Histogram({
    name: 'bitsacco_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
  });

  // Database metrics
  private readonly dbOperationsTotal = new Counter({
    name: 'bitsacco_db_operations_total',
    help: 'Total number of database operations',
    labelNames: ['operation', 'collection', 'status'],
    registers: [register],
  });

  private readonly dbOperationDuration = new Histogram({
    name: 'bitsacco_db_operation_duration_seconds',
    help: 'Database operation duration in seconds',
    labelNames: ['operation', 'collection'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
    registers: [register],
  });

  private readonly dbConnectionsActive = new Gauge({
    name: 'bitsacco_db_connections_active',
    help: 'Number of active database connections',
    registers: [register],
  });

  // Authentication metrics
  private readonly authAttemptsTotal = new Counter({
    name: 'bitsacco_auth_attempts_total',
    help: 'Total number of authentication attempts',
    labelNames: ['type', 'status'],
    registers: [register],
  });

  private readonly activeSessionsGauge = new Gauge({
    name: 'bitsacco_active_sessions_total',
    help: 'Number of active user sessions',
    registers: [register],
  });

  // Business metrics
  private readonly transactionsTotal = new Counter({
    name: 'bitsacco_transactions_total',
    help: 'Total number of transactions',
    labelNames: ['type', 'status'],
    registers: [register],
  });

  private readonly transactionAmount = new Histogram({
    name: 'bitsacco_transaction_amount',
    help: 'Transaction amounts',
    labelNames: ['type', 'currency'],
    buckets: [1, 10, 100, 1000, 10000, 100000],
    registers: [register],
  });

  // WebSocket metrics
  private readonly websocketConnections = new Gauge({
    name: 'bitsacco_websocket_connections_active',
    help: 'Number of active WebSocket connections',
    registers: [register],
  });

  // Error metrics
  private readonly errorsTotal = new Counter({
    name: 'bitsacco_errors_total',
    help: 'Total number of errors',
    labelNames: ['domain', 'type', 'severity'],
    registers: [register],
  });

  // HTTP request metrics
  recordHttpRequest(
    method: string,
    route: string,
    status: number,
    duration: number,
  ) {
    this.httpRequestsTotal.inc({ method, route, status: status.toString() });
    this.httpRequestDuration.observe(
      { method, route, status: status.toString() },
      duration,
    );
  }

  // Database metrics
  recordDbOperation(
    operation: string,
    collection: string,
    duration: number,
    success: boolean,
  ) {
    const status = success ? 'success' : 'error';
    this.dbOperationsTotal.inc({ operation, collection, status });
    this.dbOperationDuration.observe({ operation, collection }, duration);
  }

  setActiveConnections(count: number) {
    this.dbConnectionsActive.set(count);
  }

  // Authentication metrics
  recordAuthAttempt(
    type: 'jwt' | 'apikey' | 'phone' | 'nostr',
    success: boolean,
  ) {
    const status = success ? 'success' : 'failure';
    this.authAttemptsTotal.inc({ type, status });
  }

  setActiveSessions(count: number) {
    this.activeSessionsGauge.set(count);
  }

  // Business metrics
  recordTransaction(
    type: string,
    status: string,
    amount?: number,
    currency?: string,
  ) {
    this.transactionsTotal.inc({ type, status });

    if (amount !== undefined && currency) {
      this.transactionAmount.observe({ type, currency }, amount);
    }
  }

  // WebSocket metrics
  setWebSocketConnections(count: number) {
    this.websocketConnections.set(count);
  }

  incrementWebSocketConnections() {
    this.websocketConnections.inc();
  }

  decrementWebSocketConnections() {
    this.websocketConnections.dec();
  }

  // Error metrics
  recordError(
    domain: string,
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
  ) {
    this.errorsTotal.inc({ domain, type, severity });
  }

  // Health check metrics
  async getHealthMetrics() {
    return {
      httpRequestsTotal: await this.httpRequestsTotal.get(),
      dbOperationsTotal: await this.dbOperationsTotal.get(),
      authAttemptsTotal: await this.authAttemptsTotal.get(),
      transactionsTotal: await this.transactionsTotal.get(),
      errorsTotal: await this.errorsTotal.get(),
    };
  }
}
