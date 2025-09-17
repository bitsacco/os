import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Counter, Histogram } from '@opentelemetry/api';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { OperationMetricsService } from './metrics.service';
import { BusinessMetricsRepository } from '../../dashboard/db/business-metrics.repository';
import { BusinessMetricsDocument } from '../../dashboard/db/business-metrics.schema';

/**
 * Event constants for user metrics
 */
export const USER_ENGAGEMENT_METRIC = 'business:user:engagement';
export const USER_RETENTION_METRIC = 'business:user:retention';
export const FEATURE_USAGE_METRIC = 'business:feature:usage';

/**
 * User session metrics
 */
export interface UserSessionMetric {
  userId: string;
  sessionId: string;
  duration: number;
  features: string[];
  deviceType: string;
  appVersion?: string;
}

/**
 * User retention metrics
 */
export interface UserRetentionMetric {
  userId: string;
  daysSinceRegistration: number;
  isActive: boolean;
  lastFeatureUsed?: string;
}

/**
 * Feature usage metrics
 */
export interface FeatureUsageMetric {
  featureId: string;
  userId: string;
  duration: number;
  successful: boolean;
  errorType?: string;
}

/**
 * Service for tracking business metrics related to user engagement and retention
 */
@Injectable()
export class BusinessMetricsService
  extends OperationMetricsService
  implements OnModuleInit
{
  protected readonly logger = new Logger(BusinessMetricsService.name);

  // User engagement counters
  private dailyActiveUsersCounter!: Counter;
  private monthlyActiveUsersCounter!: Counter;
  private newUserRegistrationsCounter!: Counter;

  // Session metrics
  private sessionDurationHistogram!: Histogram;
  private sessionCountCounter!: Counter;

  // Feature usage metrics
  private featureUsageCounter!: Counter;
  private featureSuccessRateGauge!: Counter;
  private featureUsageDurationHistogram!: Histogram;

  // User retention metrics
  private retentionRateGauge!: Counter;

  // In-memory metrics
  private metrics = {
    // Daily active users
    dailyActiveUsers: new Set<string>(),

    // Monthly active users
    monthlyActiveUsers: new Set<string>(),

    // New user registrations
    newUserRegistrations: 0,

    // Session metrics
    sessions: {
      total: 0,
      totalDuration: 0,
      averageDuration: 0,
      byDevice: {} as Record<string, number>,
      byVersion: {} as Record<string, number>,
    },

    // Feature usage
    featureUsage: {} as Record<
      string,
      {
        usageCount: number;
        successCount: number;
        failureCount: number;
        totalDuration: number;
        averageDuration: number;
      }
    >,

    // User retention (days since registration to active status mapping)
    retention: {
      day1: { active: 0, total: 0 },
      day7: { active: 0, total: 0 },
      day30: { active: 0, total: 0 },
      day90: { active: 0, total: 0 },
    },
  };

  // Persistence tracking
  private persistenceEnabled = false;
  private lastPersistenceTime: Date | null = null;
  private persistenceErrorCount = 0;

  constructor(
    private eventEmitter: EventEmitter2,
    private readonly businessMetricsRepository?: BusinessMetricsRepository,
    private readonly schedulerRegistry?: SchedulerRegistry,
  ) {
    super('business', 'user');
    this.initializeMetrics();
  }

  /**
   * Initialize service on module startup
   */
  async onModuleInit(): Promise<void> {
    await this.initializeFromDatabase();
    this.setupPeriodicPersistence();
  }

  /**
   * Initialize business metrics
   */
  private initializeMetrics() {
    // User engagement counters
    this.dailyActiveUsersCounter = this.createCounter(
      'business.users.daily_active',
      {
        description: 'Number of daily active users',
      },
    );

    this.monthlyActiveUsersCounter = this.createCounter(
      'business.users.monthly_active',
      {
        description: 'Number of monthly active users',
      },
    );

    this.newUserRegistrationsCounter = this.createCounter(
      'business.users.new_registrations',
      {
        description: 'Number of new user registrations',
      },
    );

    // Session metrics
    this.sessionDurationHistogram = this.createHistogram(
      'business.users.session_duration',
      {
        description: 'Duration of user sessions',
        unit: 'ms',
      },
    );

    this.sessionCountCounter = this.createCounter(
      'business.users.session_count',
      {
        description: 'Number of user sessions',
      },
    );

    // Feature usage metrics
    this.featureUsageCounter = this.createCounter(
      'business.feature.usage_count',
      {
        description: 'Number of feature usages',
      },
    );

    // Create counter for feature success rate instead of gauge
    this.featureSuccessRateGauge = this.createCounter(
      'business.feature.success_rate',
      {
        description: 'Success rate of feature usage (as percentage)',
        unit: '%',
      },
    );

    this.featureUsageDurationHistogram = this.createHistogram(
      'business.feature.usage_duration',
      {
        description: 'Duration of feature usage',
        unit: 'ms',
      },
    );

    // Create counter for retention rate instead of gauge
    this.retentionRateGauge = this.createCounter(
      'business.users.retention_rate',
      {
        description: 'User retention rate (as percentage)',
        unit: '%',
      },
    );
  }

  /**
   * Record a user session metric
   * Tracks engagement and session-specific metrics
   */
  recordUserSessionMetric(metric: UserSessionMetric): void {
    // Update daily active users
    this.metrics.dailyActiveUsers.add(metric.userId);

    // Update monthly active users
    this.metrics.monthlyActiveUsers.add(metric.userId);

    // Update session metrics
    this.metrics.sessions.total++;
    this.metrics.sessions.totalDuration += metric.duration;
    this.metrics.sessions.averageDuration =
      this.metrics.sessions.totalDuration / this.metrics.sessions.total;

    // Update device type metrics
    this.metrics.sessions.byDevice[metric.deviceType] =
      (this.metrics.sessions.byDevice[metric.deviceType] || 0) + 1;

    // Update app version metrics
    if (metric.appVersion) {
      this.metrics.sessions.byVersion[metric.appVersion] =
        (this.metrics.sessions.byVersion[metric.appVersion] || 0) + 1;
    }

    // Record to OpenTelemetry
    this.sessionCountCounter.add(1, {
      deviceType: metric.deviceType,
      appVersion: metric.appVersion || 'unknown',
    });

    this.sessionDurationHistogram.record(metric.duration, {
      deviceType: metric.deviceType,
      appVersion: metric.appVersion || 'unknown',
    });

    // Record to standard operation metrics
    this.recordOperationMetric({
      operation: 'session',
      success: true,
      duration: metric.duration,
      labels: {
        userId: metric.userId,
        sessionId: metric.sessionId,
        deviceType: metric.deviceType,
        appVersion: metric.appVersion || 'unknown',
      },
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(USER_ENGAGEMENT_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record a user retention metric
   * Tracks retention at various time intervals (1 day, 7 days, 30 days, 90 days)
   */
  recordUserRetentionMetric(metric: UserRetentionMetric): void {
    // Update retention metrics based on days since registration
    if (metric.daysSinceRegistration <= 1) {
      this.metrics.retention.day1.total++;
      if (metric.isActive) {
        this.metrics.retention.day1.active++;
      }
    } else if (metric.daysSinceRegistration <= 7) {
      this.metrics.retention.day7.total++;
      if (metric.isActive) {
        this.metrics.retention.day7.active++;
      }
    } else if (metric.daysSinceRegistration <= 30) {
      this.metrics.retention.day30.total++;
      if (metric.isActive) {
        this.metrics.retention.day30.active++;
      }
    } else if (metric.daysSinceRegistration <= 90) {
      this.metrics.retention.day90.total++;
      if (metric.isActive) {
        this.metrics.retention.day90.active++;
      }
    }

    // Calculate retention rates
    const day1Rate = this.calculateRate(
      this.metrics.retention.day1.active,
      this.metrics.retention.day1.total,
    );

    const day7Rate = this.calculateRate(
      this.metrics.retention.day7.active,
      this.metrics.retention.day7.total,
    );

    const day30Rate = this.calculateRate(
      this.metrics.retention.day30.active,
      this.metrics.retention.day30.total,
    );

    const day90Rate = this.calculateRate(
      this.metrics.retention.day90.active,
      this.metrics.retention.day90.total,
    );

    // Record to OpenTelemetry
    this.retentionRateGauge.add(day1Rate, { period: 'day1' });
    this.retentionRateGauge.add(day7Rate, { period: 'day7' });
    this.retentionRateGauge.add(day30Rate, { period: 'day30' });
    this.retentionRateGauge.add(day90Rate, { period: 'day90' });

    // Emit event for potential subscribers
    this.eventEmitter.emit(USER_RETENTION_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record a feature usage metric
   * Tracks which features are being used and how successful they are
   */
  recordFeatureUsageMetric(metric: FeatureUsageMetric): void {
    // Initialize feature usage metrics if not already tracking this feature
    if (!this.metrics.featureUsage[metric.featureId]) {
      this.metrics.featureUsage[metric.featureId] = {
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0,
        averageDuration: 0,
      };
    }

    // Update feature usage metrics
    const featureMetrics = this.metrics.featureUsage[metric.featureId];
    featureMetrics.usageCount++;

    if (metric.successful) {
      featureMetrics.successCount++;
    } else {
      featureMetrics.failureCount++;
    }

    featureMetrics.totalDuration += metric.duration;
    featureMetrics.averageDuration =
      featureMetrics.totalDuration / featureMetrics.usageCount;

    // Calculate success rate
    const successRate = this.calculateRate(
      featureMetrics.successCount,
      featureMetrics.usageCount,
    );

    // Record to OpenTelemetry
    this.featureUsageCounter.add(1, {
      featureId: metric.featureId,
      successful: String(metric.successful),
      errorType: metric.errorType || 'none',
    });

    this.featureUsageDurationHistogram.record(metric.duration, {
      featureId: metric.featureId,
      successful: String(metric.successful),
    });

    this.featureSuccessRateGauge.add(successRate, {
      featureId: metric.featureId,
    });

    // Record to standard operation metrics
    this.recordOperationMetric({
      operation: 'feature_usage',
      success: metric.successful,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        userId: metric.userId,
        featureId: metric.featureId,
      },
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(FEATURE_USAGE_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record a new user registration
   */
  recordNewUserRegistration(userId: string): void {
    this.metrics.newUserRegistrations++;
    this.newUserRegistrationsCounter.add(1);

    // Add to active users sets
    this.metrics.dailyActiveUsers.add(userId);
    this.metrics.monthlyActiveUsers.add(userId);
  }

  /**
   * Get the current business metrics summary
   */
  getBusinessMetrics() {
    return {
      userEngagement: {
        dailyActiveUsers: this.metrics.dailyActiveUsers.size,
        monthlyActiveUsers: this.metrics.monthlyActiveUsers.size,
        newUserRegistrations: this.metrics.newUserRegistrations,
        dau_mau_ratio: this.calculateRate(
          this.metrics.dailyActiveUsers.size,
          this.metrics.monthlyActiveUsers.size,
        ),
      },
      sessions: {
        total: this.metrics.sessions.total,
        averageDuration: this.metrics.sessions.averageDuration,
        byDevice: this.metrics.sessions.byDevice,
        byVersion: this.metrics.sessions.byVersion,
      },
      featureUsage: this.metrics.featureUsage,
      retention: {
        day1: this.calculateRate(
          this.metrics.retention.day1.active,
          this.metrics.retention.day1.total,
        ),
        day7: this.calculateRate(
          this.metrics.retention.day7.active,
          this.metrics.retention.day7.total,
        ),
        day30: this.calculateRate(
          this.metrics.retention.day30.active,
          this.metrics.retention.day30.total,
        ),
        day90: this.calculateRate(
          this.metrics.retention.day90.active,
          this.metrics.retention.day90.total,
        ),
      },
    };
  }

  /**
   * Reset daily active users (should be called daily)
   */
  resetDailyActiveUsers(): void {
    this.metrics.dailyActiveUsers.clear();
  }

  /**
   * Reset monthly active users (should be called monthly)
   */
  resetMonthlyActiveUsers(): void {
    this.metrics.monthlyActiveUsers.clear();
  }

  /**
   * Helper method to calculate rate as a percentage
   */
  private calculateRate(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return (numerator / denominator) * 100;
  }

  /**
   * Reset all business metrics
   */
  resetMetrics(): void {
    this.metrics = {
      dailyActiveUsers: new Set<string>(),
      monthlyActiveUsers: new Set<string>(),
      newUserRegistrations: 0,
      sessions: {
        total: 0,
        totalDuration: 0,
        averageDuration: 0,
        byDevice: {},
        byVersion: {},
      },
      featureUsage: {},
      retention: {
        day1: { active: 0, total: 0 },
        day7: { active: 0, total: 0 },
        day30: { active: 0, total: 0 },
        day90: { active: 0, total: 0 },
      },
    };
  }

  // === PERSISTENCE METHODS ===

  /**
   * Initialize metrics from database on startup
   */
  private async initializeFromDatabase(): Promise<void> {
    if (!this.businessMetricsRepository) {
      this.logger.warn(
        'Business metrics repository not available, running in memory-only mode',
      );
      return;
    }

    try {
      // Load latest daily metrics to restore state
      const dailyMetrics =
        await this.businessMetricsRepository.getLatestMetrics(
          'business-metrics',
          'daily',
        );

      if (dailyMetrics) {
        this.restoreInMemoryMetrics(dailyMetrics);
        this.logger.log('Business metrics initialized from database');
      } else {
        this.logger.log('No previous business metrics found, starting fresh');
      }

      this.persistenceEnabled = true;
      this.persistenceErrorCount = 0;
    } catch (error) {
      this.logger.warn(
        'Failed to initialize from database, starting fresh',
        error,
      );
      this.persistenceEnabled = false;
      this.persistenceErrorCount++;
    }
  }

  /**
   * Setup scheduled persistence every 5 minutes
   */
  private setupPeriodicPersistence(): void {
    if (!this.schedulerRegistry || !this.persistenceEnabled) {
      return;
    }

    try {
      // Save metrics every 5 minutes
      const interval = setInterval(
        () => {
          this.persistCurrentMetrics();
        },
        5 * 60 * 1000,
      );

      this.schedulerRegistry.addInterval('business-metrics-persist', interval);
      this.logger.log('Periodic persistence scheduled every 5 minutes');
    } catch (error) {
      this.logger.error('Failed to setup periodic persistence', error);
    }
  }

  /**
   * Persist current in-memory metrics to database
   */
  private async persistCurrentMetrics(): Promise<void> {
    if (!this.businessMetricsRepository || !this.persistenceEnabled) {
      return;
    }

    try {
      const metricsData = this.buildMetricsDocument('real-time');
      await this.businessMetricsRepository.storeBusinessMetrics(metricsData);

      this.lastPersistenceTime = new Date();
      this.persistenceErrorCount = 0;
      this.logger.debug('Business metrics persisted to database');
    } catch (error) {
      this.persistenceErrorCount++;
      this.logger.error('Failed to persist business metrics', error);

      // Disable persistence after too many failures
      if (this.persistenceErrorCount >= 5) {
        this.persistenceEnabled = false;
        this.logger.error('Persistence disabled due to repeated failures');
      }
    }
  }

  /**
   * Daily aggregation job - runs at midnight
   */
  @Cron('0 0 * * *', {
    name: 'business-metrics-daily-aggregation',
    timeZone: 'UTC',
  })
  async aggregateDailyMetrics(): Promise<void> {
    if (!this.businessMetricsRepository || !this.persistenceEnabled) {
      return;
    }

    try {
      const dailyMetrics = this.buildMetricsDocument('daily');
      await this.businessMetricsRepository.storeBusinessMetrics(dailyMetrics);

      this.logger.log('Daily business metrics aggregated and stored');

      // Reset daily metrics after aggregation
      this.resetDailyActiveUsers();
    } catch (error) {
      this.logger.error('Failed to aggregate daily metrics', error);
    }
  }

  /**
   * Weekly aggregation job - runs on Sundays
   */
  @Cron('0 1 * * 0', {
    name: 'business-metrics-weekly-aggregation',
    timeZone: 'UTC',
  })
  async aggregateWeeklyMetrics(): Promise<void> {
    if (!this.businessMetricsRepository || !this.persistenceEnabled) {
      return;
    }

    try {
      const weeklyMetrics = this.buildMetricsDocument('weekly');
      await this.businessMetricsRepository.storeBusinessMetrics(weeklyMetrics);

      this.logger.log('Weekly business metrics aggregated and stored');
    } catch (error) {
      this.logger.error('Failed to aggregate weekly metrics', error);
    }
  }

  /**
   * Monthly aggregation job - runs on the 1st of each month
   */
  @Cron('0 2 1 * *', {
    name: 'business-metrics-monthly-aggregation',
    timeZone: 'UTC',
  })
  async aggregateMonthlyMetrics(): Promise<void> {
    if (!this.businessMetricsRepository || !this.persistenceEnabled) {
      return;
    }

    try {
      const monthlyMetrics = this.buildMetricsDocument('monthly');
      await this.businessMetricsRepository.storeBusinessMetrics(monthlyMetrics);

      this.logger.log('Monthly business metrics aggregated and stored');

      // Reset monthly metrics after aggregation
      this.resetMonthlyActiveUsers();
    } catch (error) {
      this.logger.error('Failed to aggregate monthly metrics', error);
    }
  }

  /**
   * Build metrics document for persistence
   */
  private buildMetricsDocument(
    period: 'real-time' | 'daily' | 'weekly' | 'monthly',
  ): Omit<BusinessMetricsDocument, '_id' | 'createdAt' | 'updatedAt'> {
    return {
      timestamp: new Date(),
      period,
      source: 'business-metrics',
      version: 1,
      __v: 0,
      userEngagement: {
        dailyActiveUsers: this.metrics.dailyActiveUsers.size,
        monthlyActiveUsers: this.metrics.monthlyActiveUsers.size,
        weeklyActiveUsers: this.metrics.dailyActiveUsers.size, // Approximation for real-time
        newUserRegistrations: this.metrics.newUserRegistrations,
        dau_mau_ratio: this.calculateRate(
          this.metrics.dailyActiveUsers.size,
          this.metrics.monthlyActiveUsers.size,
        ),
      },
      sessions: {
        total: this.metrics.sessions.total,
        averageDuration: this.metrics.sessions.averageDuration,
        byDevice: this.metrics.sessions.byDevice,
        byVersion: this.metrics.sessions.byVersion,
        peakConcurrentUsers: this.metrics.sessions.total, // Approximation
      },
      featureUsage: this.metrics.featureUsage,
      retention: {
        day1: this.calculateRate(
          this.metrics.retention.day1.active,
          this.metrics.retention.day1.total,
        ),
        day7: this.calculateRate(
          this.metrics.retention.day7.active,
          this.metrics.retention.day7.total,
        ),
        day30: this.calculateRate(
          this.metrics.retention.day30.active,
          this.metrics.retention.day30.total,
        ),
        day90: this.calculateRate(
          this.metrics.retention.day90.active,
          this.metrics.retention.day90.total,
        ),
      },
    };
  }

  /**
   * Restore in-memory metrics from database document
   */
  private restoreInMemoryMetrics(metricsDoc: BusinessMetricsDocument): void {
    try {
      // Restore basic counts
      this.metrics.newUserRegistrations =
        metricsDoc.userEngagement.newUserRegistrations;
      this.metrics.sessions.total = metricsDoc.sessions.total;
      this.metrics.sessions.averageDuration =
        metricsDoc.sessions.averageDuration;
      this.metrics.sessions.byDevice = metricsDoc.sessions.byDevice || {};
      this.metrics.sessions.byVersion = metricsDoc.sessions.byVersion || {};

      // Restore feature usage
      this.metrics.featureUsage = metricsDoc.featureUsage || {};

      // Note: We can't restore Sets (dailyActiveUsers, monthlyActiveUsers) from
      // aggregated data, so we start fresh but preserve counts in the new document

      this.logger.debug('In-memory metrics restored from database');
    } catch (error) {
      this.logger.error('Failed to restore in-memory metrics', error);
    }
  }

  /**
   * Get persistence status for health monitoring
   */
  getPersistenceStatus(): {
    enabled: boolean;
    lastPersistenceTime: Date | null;
    errorCount: number;
    repositoryAvailable: boolean;
  } {
    return {
      enabled: this.persistenceEnabled,
      lastPersistenceTime: this.lastPersistenceTime,
      errorCount: this.persistenceErrorCount,
      repositoryAvailable: !!this.businessMetricsRepository,
    };
  }

  /**
   * Manual persistence trigger for testing or emergency use
   */
  async forcePersistence(): Promise<boolean> {
    try {
      await this.persistCurrentMetrics();
      return true;
    } catch (error) {
      this.logger.error('Forced persistence failed', error);
      return false;
    }
  }

  /**
   * Get historical metrics from database
   */
  async getHistoricalMetrics(days: number = 30): Promise<any[]> {
    if (!this.businessMetricsRepository) {
      return [];
    }

    try {
      return await this.businessMetricsRepository.getUserEngagementTrends(days);
    } catch (error) {
      this.logger.error('Failed to get historical metrics', error);
      return [];
    }
  }
}
