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
