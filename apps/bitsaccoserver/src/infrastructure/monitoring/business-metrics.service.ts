import { Injectable } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { TelemetryService } from './telemetry.service';

@Injectable()
export class BusinessMetricsService {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly telemetryService: TelemetryService,
  ) {}

  // User metrics
  async recordUserRegistration(method: 'phone' | 'nostr', success: boolean) {
    this.metricsService.recordAuthAttempt(method, success);

    await this.telemetryService.executeWithSpan(
      'user.registration',
      async () => {
        this.telemetryService.recordEvent('user_registered', {
          method,
          success,
        });
      },
      { 'user.registration.method': method },
    );
  }

  // Auth-specific metrics
  async recordTokenOperation(
    userId: string,
    operation: 'issue' | 'verify' | 'refresh' | 'revoke',
    success: boolean,
    duration: number,
    errorType?: string,
  ) {
    const status = success ? 'success' : 'failure';
    this.metricsService.recordTransaction(`token_${operation}`, status);

    await this.telemetryService.executeWithSpan(
      'auth.token_operation',
      async () => {
        this.telemetryService.recordEvent('token_operation', {
          user_id: userId,
          operation,
          success,
          duration_ms: duration,
          error_type: errorType,
        });
      },
      {
        'auth.token.operation': operation,
        'auth.token.success': success,
        'auth.token.duration_ms': duration,
      },
    );
  }

  async recordApiKeyOperation(
    keyId: string,
    operation: 'create' | 'validate' | 'revoke' | 'rotate',
    success: boolean,
    duration: number,
    errorType?: string,
  ) {
    const status = success ? 'success' : 'failure';
    this.metricsService.recordTransaction(`apikey_${operation}`, status);

    await this.telemetryService.executeWithSpan(
      'auth.apikey_operation',
      async () => {
        this.telemetryService.recordEvent('apikey_operation', {
          key_id: keyId,
          operation,
          success,
          duration_ms: duration,
          error_type: errorType,
        });
      },
      {
        'auth.apikey.operation': operation,
        'auth.apikey.success': success,
        'auth.apikey.duration_ms': duration,
      },
    );
  }

  async recordAuthMetric(metric: {
    userId?: string;
    success: boolean;
    duration: number;
    authType: string;
    errorType?: string;
  }) {
    const status = metric.success ? 'success' : 'failure';
    this.metricsService.recordTransaction(`auth_${metric.authType}`, status);

    await this.telemetryService.executeWithSpan(
      'auth.attempt',
      async () => {
        this.telemetryService.recordEvent('auth_attempt', {
          user_id: metric.userId,
          auth_type: metric.authType,
          success: metric.success,
          duration_ms: metric.duration,
          error_type: metric.errorType,
        });
      },
      {
        'auth.type': metric.authType,
        'auth.success': metric.success,
        'auth.duration_ms': metric.duration,
      },
    );
  }

  async recordUserLogin(
    method: 'jwt' | 'apikey' | 'phone' | 'nostr',
    success: boolean,
    userId?: string,
  ) {
    this.metricsService.recordAuthAttempt(method, success);

    await this.telemetryService.executeWithSpan(
      'user.login',
      async () => {
        this.telemetryService.recordEvent('user_login', {
          method,
          success,
          user_id: userId || 'unknown',
        });
      },
      { 'auth.method': method, 'auth.success': success },
    );
  }

  async recordLoginMetric(metric: {
    userId?: string;
    success: boolean;
    duration: number;
    authType: string;
    errorType?: string;
  }) {
    await this.recordAuthMetric(metric);
  }

  async recordRegisterMetric(metric: {
    userId?: string;
    success: boolean;
    duration: number;
    authType: string;
    errorType?: string;
  }) {
    await this.recordAuthMetric(metric);
  }

  async recordVerifyMetric(metric: {
    userId?: string;
    success: boolean;
    duration: number;
    method: string;
    errorType?: string;
  }) {
    await this.recordAuthMetric({
      ...metric,
      authType: `verify_${metric.method}`,
    });
  }

  // Chama metrics
  async recordChamaCreation(chamaId: string, memberCount: number) {
    this.metricsService.recordTransaction('chama_creation', 'success');

    await this.telemetryService.executeWithSpan(
      'chama.creation',
      async () => {
        this.telemetryService.recordEvent('chama_created', {
          chama_id: chamaId,
          initial_member_count: memberCount,
        });
      },
      { 'chama.id': chamaId, 'chama.member_count': memberCount },
    );
  }

  async recordChamaTransaction(
    chamaId: string,
    type: 'deposit' | 'withdrawal' | 'transfer',
    amount: number,
    currency: string,
    success: boolean,
  ) {
    const status = success ? 'success' : 'failure';
    this.metricsService.recordTransaction(
      `chama_${type}`,
      status,
      amount,
      currency,
    );

    await this.telemetryService.executeWithSpan(
      'chama.transaction',
      async () => {
        this.telemetryService.recordEvent('chama_transaction', {
          chama_id: chamaId,
          transaction_type: type,
          amount,
          currency,
          success,
        });
      },
      {
        'chama.id': chamaId,
        'transaction.type': type,
        'transaction.amount': amount,
        'transaction.currency': currency,
      },
    );
  }

  // Wallet metrics
  async recordWalletTransaction(
    userId: string,
    type: 'send' | 'receive' | 'swap',
    amount: number,
    currency: string,
    success: boolean,
  ) {
    const status = success ? 'success' : 'failure';
    this.metricsService.recordTransaction(
      `wallet_${type}`,
      status,
      amount,
      currency,
    );

    await this.telemetryService.executeWithSpan(
      'wallet.transaction',
      async () => {
        this.telemetryService.recordEvent('wallet_transaction', {
          user_id: userId,
          transaction_type: type,
          amount,
          currency,
          success,
        });
      },
      {
        'user.id': userId,
        'transaction.type': type,
        'transaction.amount': amount,
        'transaction.currency': currency,
      },
    );
  }

  // Shares metrics
  async recordShareTransaction(
    userId: string,
    type: 'buy' | 'sell',
    quantity: number,
    price: number,
    success: boolean,
  ) {
    const status = success ? 'success' : 'failure';
    this.metricsService.recordTransaction(
      `shares_${type}`,
      status,
      price,
      'KES',
    );

    await this.telemetryService.executeWithSpan(
      'shares.transaction',
      async () => {
        this.telemetryService.recordEvent('shares_transaction', {
          user_id: userId,
          transaction_type: type,
          quantity,
          price,
          success,
        });
      },
      {
        'user.id': userId,
        'shares.transaction.type': type,
        'shares.quantity': quantity,
        'shares.price': price,
      },
    );
  }

  // Notification metrics
  async recordNotificationSent(
    userId: string,
    type: 'sms' | 'nostr' | 'websocket',
    category: string,
    success: boolean,
  ) {
    const status = success ? 'success' : 'failure';
    this.metricsService.recordTransaction('notification', status);

    await this.telemetryService.executeWithSpan(
      'notification.send',
      async () => {
        this.telemetryService.recordEvent('notification_sent', {
          user_id: userId,
          notification_type: type,
          category,
          success,
        });
      },
      {
        'user.id': userId,
        'notification.type': type,
        'notification.category': category,
      },
    );
  }

  // Communication metrics
  async recordSMSSent(phone: string, success: boolean, cost?: number) {
    const status = success ? 'success' : 'failure';
    this.metricsService.recordTransaction('sms', status);

    await this.telemetryService.executeWithSpan(
      'communication.sms',
      async () => {
        this.telemetryService.recordEvent('sms_sent', {
          phone: phone.slice(-4), // Only log last 4 digits for privacy
          success,
          cost: cost || 0,
        });
      },
      {
        'sms.success': success,
        'sms.cost': cost || 0,
      },
    );
  }

  async recordNostrEvent(eventType: string, success: boolean) {
    const status = success ? 'success' : 'failure';
    this.metricsService.recordTransaction('nostr_event', status);

    await this.telemetryService.executeWithSpan(
      'communication.nostr',
      async () => {
        this.telemetryService.recordEvent('nostr_event', {
          event_type: eventType,
          success,
        });
      },
      {
        'nostr.event_type': eventType,
        'nostr.success': success,
      },
    );
  }

  // Error tracking
  async recordDomainError(
    domain: string,
    errorType: string,
    error: Error,
    userId?: string,
  ) {
    this.metricsService.recordError(domain, errorType, 'high');

    await this.telemetryService.executeWithSpan(
      'error.occurred',
      async () => {
        this.telemetryService.recordEvent('domain_error', {
          domain,
          error_type: errorType,
          error_message: error.message,
          user_id: userId || 'unknown',
        });
      },
      {
        'error.domain': domain,
        'error.type': errorType,
        'error.message': error.message,
      },
    );
  }

  // Performance metrics
  async recordOperationDuration(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>,
  ) {
    await this.telemetryService.executeWithSpan(
      'performance.operation',
      async () => {
        this.telemetryService.recordEvent('operation_completed', {
          operation,
          duration_ms: duration,
          success,
          ...metadata,
        });
      },
      {
        'operation.name': operation,
        'operation.duration_ms': duration,
        'operation.success': success,
      },
    );
  }
}
