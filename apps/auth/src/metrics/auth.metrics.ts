import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Counter, Histogram } from '@opentelemetry/api';
import { OperationMetricsService } from '@bitsacco/common';

// Event constants for metrics
export const AUTH_LOGIN_METRIC = 'auth:login';
export const AUTH_REGISTER_METRIC = 'auth:register';
export const AUTH_VERIFY_METRIC = 'auth:verify';
export const AUTH_TOKEN_METRIC = 'auth:token';

/**
 * Metrics for login operations
 */
export interface AuthLoginMetric {
  userId?: string;
  success: boolean;
  duration: number;
  authType: 'phone' | 'npub' | 'unknown';
  errorType?: string;
}

/**
 * Metrics for registration operations
 */
export interface AuthRegisterMetric {
  userId?: string;
  success: boolean;
  duration: number;
  authType: 'phone' | 'npub' | 'unknown';
  errorType?: string;
}

/**
 * Metrics for verification operations
 */
export interface AuthVerifyMetric {
  userId?: string;
  success: boolean;
  duration: number;
  method: 'sms' | 'nostr';
  errorType?: string;
}

/**
 * Metrics for token operations
 */
export interface AuthTokenMetric {
  userId?: string;
  operation: 'issue' | 'refresh' | 'verify' | 'revoke';
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Service for tracking authentication operations metrics
 */
@Injectable()
export class AuthMetricsService extends OperationMetricsService {
  private readonly logger = new Logger(AuthMetricsService.name);

  // Auth specific counters
  private loginByTypeCounter!: Counter;
  private registrationByTypeCounter!: Counter;
  private verificationByMethodCounter!: Counter;
  private tokenOperationCounter!: Counter;

  // Auth specific histograms
  private loginByTypeHistogram!: Histogram;
  private registrationByTypeHistogram!: Histogram;
  private verificationByMethodHistogram!: Histogram;
  private tokenOperationHistogram!: Histogram;

  // In-memory metrics for backward compatibility and API endpoint
  private metrics = {
    // Login metrics
    loginsByType: {
      phone: 0,
      npub: 0,
      unknown: 0,
    },
    successfulLoginsByType: {
      phone: 0,
      npub: 0,
      unknown: 0,
    },
    
    // Registration metrics
    registrationsByType: {
      phone: 0,
      npub: 0,
      unknown: 0,
    },
    successfulRegistrationsByType: {
      phone: 0,
      npub: 0,
      unknown: 0,
    },
    
    // Verification metrics
    verificationsByMethod: {
      sms: 0,
      nostr: 0,
    },
    successfulVerificationsByMethod: {
      sms: 0,
      nostr: 0,
    },
    
    // Token metrics
    tokenOperations: {
      issue: 0,
      refresh: 0,
      verify: 0,
      revoke: 0,
    },
    successfulTokenOperations: {
      issue: 0,
      refresh: 0,
      verify: 0,
      revoke: 0,
    },
    
    // Error tracking
    errorTypes: {} as Record<string, number>,
  };

  constructor(private eventEmitter: EventEmitter2) {
    super('auth', 'authentication');
    this.initializeMetrics();
  }

  /**
   * Initialize auth-specific metrics
   */
  private initializeMetrics() {
    // Login by type counter
    this.loginByTypeCounter = this.createCounter('auth.login.by_type', {
      description: 'Number of login attempts by authentication type',
    });

    // Registration by type counter
    this.registrationByTypeCounter = this.createCounter('auth.register.by_type', {
      description: 'Number of registration attempts by authentication type',
    });

    // Verification by method counter
    this.verificationByMethodCounter = this.createCounter('auth.verify.by_method', {
      description: 'Number of verification attempts by method',
    });

    // Token operation counter
    this.tokenOperationCounter = this.createCounter('auth.token.operations', {
      description: 'Number of token operations by operation type',
    });

    // Login by type histogram
    this.loginByTypeHistogram = this.createHistogram('auth.login.by_type.duration', {
      description: 'Duration of login operations by authentication type',
      unit: 'ms',
    });

    // Registration by type histogram
    this.registrationByTypeHistogram = this.createHistogram('auth.register.by_type.duration', {
      description: 'Duration of registration operations by authentication type',
      unit: 'ms',
    });

    // Verification by method histogram
    this.verificationByMethodHistogram = this.createHistogram('auth.verify.by_method.duration', {
      description: 'Duration of verification operations by method',
      unit: 'ms',
    });

    // Token operation histogram
    this.tokenOperationHistogram = this.createHistogram('auth.token.operations.duration', {
      description: 'Duration of token operations by operation type',
      unit: 'ms',
    });
  }

  /**
   * Record metrics for login attempts
   */
  recordLoginMetric(metric: AuthLoginMetric): void {
    // Update in-memory metrics
    this.metrics.loginsByType[metric.authType]++;
    
    if (metric.success) {
      this.metrics.successfulLoginsByType[metric.authType]++;
    }

    if (metric.errorType) {
      this.metrics.errorTypes[metric.errorType] = (this.metrics.errorTypes[metric.errorType] || 0) + 1;
    }

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: 'login',
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        userId: metric.userId || 'anonymous',
        authType: metric.authType,
      },
    });

    // Record auth type specific metrics
    this.loginByTypeCounter.add(1, {
      authType: metric.authType,
      success: String(metric.success),
    });

    this.loginByTypeHistogram.record(metric.duration, {
      authType: metric.authType,
      success: String(metric.success),
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(AUTH_LOGIN_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record metrics for registration attempts
   */
  recordRegisterMetric(metric: AuthRegisterMetric): void {
    // Update in-memory metrics
    this.metrics.registrationsByType[metric.authType]++;
    
    if (metric.success) {
      this.metrics.successfulRegistrationsByType[metric.authType]++;
    }

    if (metric.errorType) {
      this.metrics.errorTypes[metric.errorType] = (this.metrics.errorTypes[metric.errorType] || 0) + 1;
    }

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: 'register',
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        userId: metric.userId || 'anonymous',
        authType: metric.authType,
      },
    });

    // Record auth type specific metrics
    this.registrationByTypeCounter.add(1, {
      authType: metric.authType,
      success: String(metric.success),
    });

    this.registrationByTypeHistogram.record(metric.duration, {
      authType: metric.authType,
      success: String(metric.success),
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(AUTH_REGISTER_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record metrics for verification attempts
   */
  recordVerifyMetric(metric: AuthVerifyMetric): void {
    // Update in-memory metrics
    this.metrics.verificationsByMethod[metric.method]++;
    
    if (metric.success) {
      this.metrics.successfulVerificationsByMethod[metric.method]++;
    }

    if (metric.errorType) {
      this.metrics.errorTypes[metric.errorType] = (this.metrics.errorTypes[metric.errorType] || 0) + 1;
    }

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: 'verify',
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        userId: metric.userId || 'anonymous',
        method: metric.method,
      },
    });

    // Record verification method specific metrics
    this.verificationByMethodCounter.add(1, {
      method: metric.method,
      success: String(metric.success),
    });

    this.verificationByMethodHistogram.record(metric.duration, {
      method: metric.method,
      success: String(metric.success),
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(AUTH_VERIFY_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record metrics for token operations
   */
  recordTokenMetric(metric: AuthTokenMetric): void {
    // Update in-memory metrics
    this.metrics.tokenOperations[metric.operation]++;
    
    if (metric.success) {
      this.metrics.successfulTokenOperations[metric.operation]++;
    }

    if (metric.errorType) {
      this.metrics.errorTypes[metric.errorType] = (this.metrics.errorTypes[metric.errorType] || 0) + 1;
    }

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: `token_${metric.operation}`,
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        userId: metric.userId || 'anonymous',
        operation: metric.operation,
      },
    });

    // Record token operation specific metrics
    this.tokenOperationCounter.add(1, {
      operation: metric.operation,
      success: String(metric.success),
    });

    this.tokenOperationHistogram.record(metric.duration, {
      operation: metric.operation,
      success: String(metric.success),
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(AUTH_TOKEN_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get the current metrics summary
   */
  getMetrics() {
    // Calculate success rates
    const loginSuccessRate = {
      total: this.calculateSuccessRate(
        Object.values(this.metrics.successfulLoginsByType).reduce((a, b) => a + b, 0),
        Object.values(this.metrics.loginsByType).reduce((a, b) => a + b, 0)
      ),
      byType: {} as Record<string, number>,
    };

    const registrationSuccessRate = {
      total: this.calculateSuccessRate(
        Object.values(this.metrics.successfulRegistrationsByType).reduce((a, b) => a + b, 0),
        Object.values(this.metrics.registrationsByType).reduce((a, b) => a + b, 0)
      ),
      byType: {} as Record<string, number>,
    };

    const verificationSuccessRate = {
      total: this.calculateSuccessRate(
        Object.values(this.metrics.successfulVerificationsByMethod).reduce((a, b) => a + b, 0),
        Object.values(this.metrics.verificationsByMethod).reduce((a, b) => a + b, 0)
      ),
      byMethod: {} as Record<string, number>,
    };

    const tokenSuccessRate = {
      total: this.calculateSuccessRate(
        Object.values(this.metrics.successfulTokenOperations).reduce((a, b) => a + b, 0),
        Object.values(this.metrics.tokenOperations).reduce((a, b) => a + b, 0)
      ),
      byOperation: {} as Record<string, number>,
    };

    // Calculate success rates by type/method/operation
    for (const type of Object.keys(this.metrics.loginsByType)) {
      loginSuccessRate.byType[type] = this.calculateSuccessRate(
        this.metrics.successfulLoginsByType[type],
        this.metrics.loginsByType[type]
      );
    }

    for (const type of Object.keys(this.metrics.registrationsByType)) {
      registrationSuccessRate.byType[type] = this.calculateSuccessRate(
        this.metrics.successfulRegistrationsByType[type],
        this.metrics.registrationsByType[type]
      );
    }

    for (const method of Object.keys(this.metrics.verificationsByMethod)) {
      verificationSuccessRate.byMethod[method] = this.calculateSuccessRate(
        this.metrics.successfulVerificationsByMethod[method],
        this.metrics.verificationsByMethod[method]
      );
    }

    for (const operation of Object.keys(this.metrics.tokenOperations)) {
      tokenSuccessRate.byOperation[operation] = this.calculateSuccessRate(
        this.metrics.successfulTokenOperations[operation],
        this.metrics.tokenOperations[operation]
      );
    }

    return {
      login: {
        attempts: this.metrics.loginsByType,
        successful: this.metrics.successfulLoginsByType,
        successRate: loginSuccessRate,
      },
      registration: {
        attempts: this.metrics.registrationsByType,
        successful: this.metrics.successfulRegistrationsByType,
        successRate: registrationSuccessRate,
      },
      verification: {
        attempts: this.metrics.verificationsByMethod,
        successful: this.metrics.successfulVerificationsByMethod,
        successRate: verificationSuccessRate,
      },
      token: {
        operations: this.metrics.tokenOperations,
        successful: this.metrics.successfulTokenOperations,
        successRate: tokenSuccessRate,
      },
      errors: this.metrics.errorTypes,
    };
  }

  /**
   * Helper method to calculate success rate percentage
   */
  private calculateSuccessRate(successful: number, total: number): number {
    if (total === 0) return 0;
    return (successful / total) * 100;
  }

  /**
   * Reset all metrics to zero
   */
  resetMetrics(): void {
    // Reset login metrics
    for (const type of Object.keys(this.metrics.loginsByType)) {
      this.metrics.loginsByType[type] = 0;
      this.metrics.successfulLoginsByType[type] = 0;
    }

    // Reset registration metrics
    for (const type of Object.keys(this.metrics.registrationsByType)) {
      this.metrics.registrationsByType[type] = 0;
      this.metrics.successfulRegistrationsByType[type] = 0;
    }

    // Reset verification metrics
    for (const method of Object.keys(this.metrics.verificationsByMethod)) {
      this.metrics.verificationsByMethod[method] = 0;
      this.metrics.successfulVerificationsByMethod[method] = 0;
    }

    // Reset token metrics
    for (const operation of Object.keys(this.metrics.tokenOperations)) {
      this.metrics.tokenOperations[operation] = 0;
      this.metrics.successfulTokenOperations[operation] = 0;
    }

    // Reset error types
    this.metrics.errorTypes = {};
  }
}