import { Injectable } from '@nestjs/common';

// Mock Redis Service
@Injectable()
export class MockRedisService {
  private storage = new Map<string, any>();

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.storage.set(key, value);
    if (ttl) {
      setTimeout(() => this.storage.delete(key), ttl * 1000);
    }
  }

  async get(key: string): Promise<any> {
    return this.storage.get(key);
  }

  async del(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async flushall(): Promise<void> {
    this.storage.clear();
  }

  async quit(): Promise<void> {
    this.storage.clear();
  }
}

// Mock Swap Service Client
@Injectable()
export class MockSwapServiceClient {
  async createSwap(request: any): Promise<any> {
    return {
      success: true,
      swap: {
        id: 'test-swap-id',
        userId: request.userId,
        fromCurrency: request.fromCurrency,
        toCurrency: request.toCurrency,
        amount: request.amount,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }

  async getSwap(request: any): Promise<any> {
    return {
      success: true,
      swap: {
        id: request.swapId,
        userId: request.userId,
        status: 'completed',
      },
    };
  }

  async listSwaps(request: any): Promise<any> {
    return {
      success: true,
      swaps: [],
      total: 0,
      page: request.page || 1,
      limit: request.limit || 10,
    };
  }

  async getExchangeRate(request: any): Promise<any> {
    return {
      success: true,
      rate: 1500000, // 1 BTC = 1.5M KES
      fromCurrency: request.fromCurrency,
      toCurrency: request.toCurrency,
      timestamp: new Date().toISOString(),
    };
  }

  async cancelSwap(request: any): Promise<any> {
    return {
      success: true,
      swap: {
        id: request.swapId,
        status: 'cancelled',
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// Mock SMS Service
@Injectable()
export class MockSmsService {
  private sentMessages: any[] = [];

  async sendSms(phone: string, message: string): Promise<any> {
    const messageData = {
      phone,
      message,
      messageId: `test-msg-${Date.now()}`,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };

    this.sentMessages.push(messageData);

    return {
      success: true,
      messageId: messageData.messageId,
      cost: 'KES 0.8000',
    };
  }

  getSentMessages() {
    return this.sentMessages;
  }

  clearSentMessages() {
    this.sentMessages = [];
  }
}

// Mock Nostr Service
@Injectable()
export class MockNostrService {
  private publishedEvents: any[] = [];

  async publishEvent(event: any): Promise<any> {
    const eventData = {
      ...event,
      id: `test-event-${Date.now()}`,
      sig: 'test-signature',
      created_at: Math.floor(Date.now() / 1000),
    };

    this.publishedEvents.push(eventData);

    return {
      success: true,
      eventId: eventData.id,
    };
  }

  getPublishedEvents() {
    return this.publishedEvents;
  }

  clearPublishedEvents() {
    this.publishedEvents = [];
  }
}

// Mock Metrics Service
@Injectable()
export class MockMetricsService {
  private metrics = new Map<string, any>();

  recordHttpRequest(
    method: string,
    route: string,
    status: number,
    duration: number,
  ) {
    const key = `http_${method}_${route}_${status}`;
    this.metrics.set(key, {
      method,
      route,
      status,
      duration,
      timestamp: Date.now(),
    });
  }

  recordDbOperation(
    operation: string,
    collection: string,
    duration: number,
    success: boolean,
  ) {
    const key = `db_${operation}_${collection}`;
    this.metrics.set(key, {
      operation,
      collection,
      duration,
      success,
      timestamp: Date.now(),
    });
  }

  recordAuthAttempt(type: string, success: boolean) {
    const key = `auth_${type}`;
    this.metrics.set(key, { type, success, timestamp: Date.now() });
  }

  recordTransaction(
    type: string,
    status: string,
    amount?: number,
    currency?: string,
  ) {
    const key = `transaction_${type}`;
    this.metrics.set(key, {
      type,
      status,
      amount,
      currency,
      timestamp: Date.now(),
    });
  }

  recordError(domain: string, type: string, severity: string) {
    const key = `error_${domain}_${type}`;
    this.metrics.set(key, { domain, type, severity, timestamp: Date.now() });
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }

  clearMetrics() {
    this.metrics.clear();
  }

  // Additional mock methods
  setActiveConnections = jest.fn();
  setActiveSessions = jest.fn();
  setWebSocketConnections = jest.fn();
  incrementWebSocketConnections = jest.fn();
  decrementWebSocketConnections = jest.fn();
  getHealthMetrics = jest.fn(() => Promise.resolve({}));
}

// Mock Business Metrics Service
@Injectable()
export class MockBusinessMetricsService {
  private events: any[] = [];

  async recordUserRegistration(method: string, success: boolean) {
    this.events.push({
      type: 'user_registration',
      method,
      success,
      timestamp: Date.now(),
    });
  }

  async recordUserLogin(method: string, success: boolean, userId?: string) {
    this.events.push({
      type: 'user_login',
      method,
      success,
      userId,
      timestamp: Date.now(),
    });
  }

  async recordChamaCreation(chamaId: string, memberCount: number) {
    this.events.push({
      type: 'chama_creation',
      chamaId,
      memberCount,
      timestamp: Date.now(),
    });
  }

  async recordWalletTransaction(
    userId: string,
    type: string,
    amount: number,
    currency: string,
    success: boolean,
  ) {
    this.events.push({
      type: 'wallet_transaction',
      userId,
      transactionType: type,
      amount,
      currency,
      success,
      timestamp: Date.now(),
    });
  }

  async recordNotificationSent(
    userId: string,
    type: string,
    category: string,
    success: boolean,
  ) {
    this.events.push({
      type: 'notification_sent',
      userId,
      notificationType: type,
      category,
      success,
      timestamp: Date.now(),
    });
  }

  async recordDomainError(
    domain: string,
    errorType: string,
    error: Error,
    userId?: string,
  ) {
    this.events.push({
      type: 'domain_error',
      domain,
      errorType,
      error: error.message,
      userId,
      timestamp: Date.now(),
    });
  }

  async recordOperationDuration(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: any,
  ) {
    this.events.push({
      type: 'operation_duration',
      operation,
      duration,
      success,
      metadata,
      timestamp: Date.now(),
    });
  }

  getEvents() {
    return this.events;
  }

  clearEvents() {
    this.events = [];
  }
}

// Mock Telemetry Service
@Injectable()
export class MockTelemetryService {
  private spans: any[] = [];
  private events: any[] = [];

  async executeWithSpan<T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: any,
  ): Promise<T> {
    const spanData = {
      operationName,
      attributes,
      startTime: Date.now(),
    };

    try {
      const result = await operation();
      spanData['duration'] = Date.now() - spanData.startTime;
      spanData['success'] = true;
      this.spans.push(spanData);
      return result;
    } catch (error) {
      spanData['duration'] = Date.now() - spanData.startTime;
      spanData['success'] = false;
      spanData['error'] = (error as Error).message;
      this.spans.push(spanData);
      throw error;
    }
  }

  recordEvent(name: string, attributes?: any) {
    this.events.push({ name, attributes, timestamp: Date.now() });
  }

  setSpanAttributes(attributes: any) {
    // Mock implementation
  }

  getSpans() {
    return this.spans;
  }

  getEvents() {
    return this.events;
  }

  clearSpans() {
    this.spans = [];
  }

  clearEvents() {
    this.events = [];
  }
}
