import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BusinessMetricsRepository } from '../db/business-metrics.repository';
import { FinancialMetricsRepository } from '../db/financial-metrics.repository';
import { OperationalMetricsRepository } from '../db/operational-metrics.repository';
import { SharesMetricsRepository } from '../db/shares-metrics.repository';

/**
 * Health status enumeration
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
  UNAVAILABLE = 'unavailable',
}

/**
 * Storage type enumeration
 */
export enum StorageType {
  PERSISTENT = 'persistent',
  MEMORY_ONLY = 'memory-only',
  HYBRID = 'hybrid',
}

/**
 * Individual repository health check result
 */
export interface RepositoryHealthCheck {
  repository: string;
  status: HealthStatus;
  responseTime: number;
  lastSuccessfulWrite: Date | null;
  lastSuccessfulRead: Date | null;
  errorCount: number;
  errorMessage?: string;
}

/**
 * Overall metrics system health status
 */
export interface MetricsHealthStatus {
  overallStatus: HealthStatus;
  storageType: StorageType;
  timestamp: Date;
  repositories: RepositoryHealthCheck[];
  systemMetrics: {
    totalRepositories: number;
    healthyRepositories: number;
    degradedRepositories: number;
    criticalRepositories: number;
    unavailableRepositories: number;
    averageResponseTime: number;
  };
  recommendations: string[];
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  checkInterval: number; // seconds
  responseTimeThreshold: number; // milliseconds
  errorCountThreshold: number;
  maxConcurrentChecks: number;
}

/**
 * Service for monitoring the health of the metrics persistence system
 * Provides health checks, alerts, and fallback management
 */
@Injectable()
export class MetricsHealthService {
  private readonly logger = new Logger(MetricsHealthService.name);

  private readonly config: HealthCheckConfig = {
    checkInterval: 60, // 1 minute
    responseTimeThreshold: 5000, // 5 seconds
    errorCountThreshold: 5,
    maxConcurrentChecks: 4,
  };

  private healthHistory: MetricsHealthStatus[] = [];
  private readonly maxHistorySize = 100;

  // Repository error tracking
  private repositoryErrors: Map<
    string,
    { count: number; lastError: Date; lastMessage: string }
  > = new Map();

  constructor(
    private readonly businessMetricsRepository: BusinessMetricsRepository,
    private readonly financialMetricsRepository: FinancialMetricsRepository,
    private readonly operationalMetricsRepository: OperationalMetricsRepository,
    private readonly sharesMetricsRepository: SharesMetricsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('MetricsHealthService initialized');
    this.initializeErrorTracking();
  }

  /**
   * Scheduled health check that runs every minute
   */
  @Cron('0 * * * * *', {
    name: 'metrics-health-check',
    timeZone: 'UTC',
  })
  async performScheduledHealthCheck(): Promise<void> {
    try {
      await this.checkMetricsHealth(); // This now handles history and events
    } catch (error) {
      this.logger.error('Scheduled health check failed', error);
    }
  }

  /**
   * Comprehensive health check of all metrics repositories
   */
  async checkMetricsHealth(): Promise<MetricsHealthStatus> {
    const startTime = Date.now();
    this.logger.debug('Starting metrics health check');

    const repositories = [
      { name: 'business-metrics', repository: this.businessMetricsRepository },
      {
        name: 'financial-metrics',
        repository: this.financialMetricsRepository,
      },
      {
        name: 'operational-metrics',
        repository: this.operationalMetricsRepository,
      },
      { name: 'shares-metrics', repository: this.sharesMetricsRepository },
    ];

    // Perform health checks concurrently
    const healthCheckPromises = repositories.map(({ name, repository }) =>
      this.checkRepositoryHealth(name, repository),
    );

    const repositoryHealthChecks = await Promise.all(healthCheckPromises);

    // Calculate overall system metrics
    const systemMetrics = this.calculateSystemMetrics(repositoryHealthChecks);
    const overallStatus = this.determineOverallStatus(repositoryHealthChecks);
    const storageType = this.determineStorageType(repositoryHealthChecks);
    const recommendations = this.generateRecommendations(
      repositoryHealthChecks,
    );

    const healthStatus: MetricsHealthStatus = {
      overallStatus,
      storageType,
      timestamp: new Date(),
      repositories: repositoryHealthChecks,
      systemMetrics,
      recommendations,
    };

    const executionTime = Date.now() - startTime;
    this.logger.debug(`Health check completed in ${executionTime}ms`);

    // Store in history and handle events
    this.storeHealthHistory(healthStatus);
    this.handleHealthStatusChange(healthStatus);

    return healthStatus;
  }

  /**
   * Check the health of a specific repository
   */
  async checkRepositoryHealth(
    repositoryName: string,
    repository: any,
  ): Promise<RepositoryHealthCheck> {
    const startTime = Date.now();
    let healthCheck: RepositoryHealthCheck = {
      repository: repositoryName,
      status: HealthStatus.HEALTHY,
      responseTime: 0,
      lastSuccessfulWrite: null,
      lastSuccessfulRead: null,
      errorCount: 0,
    };

    try {
      // Test database connectivity
      const isHealthy = await repository.healthCheck();
      const responseTime = Date.now() - startTime;

      if (!isHealthy) {
        throw new Error('Repository health check returned false');
      }

      // Test read operation
      const readStartTime = Date.now();
      await repository.getLatestMetrics(`${repositoryName}`, 'real-time');
      const readTime = Date.now() - readStartTime;

      // Get error count from tracking
      const errorInfo = this.repositoryErrors.get(repositoryName);
      const errorCount = errorInfo?.count || 0;

      healthCheck = {
        ...healthCheck,
        responseTime,
        lastSuccessfulRead: new Date(),
        errorCount,
        status: this.determineRepositoryStatus(responseTime, errorCount),
      };

      // Log read time for debugging if needed
      if (readTime > 1000) {
        this.logger.warn(
          `Slow read operation for ${repositoryName}: ${readTime}ms`,
        );
      }

      // Reset error count on successful health check
      if (errorInfo) {
        this.repositoryErrors.set(repositoryName, {
          ...errorInfo,
          count: 0,
        });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.trackRepositoryError(repositoryName, error.message);

      const errorInfo = this.repositoryErrors.get(repositoryName);
      const errorCount = errorInfo?.count || 1;

      healthCheck = {
        ...healthCheck,
        status: HealthStatus.CRITICAL,
        responseTime,
        errorCount,
        errorMessage: error.message,
      };

      this.logger.warn(`Repository health check failed for ${repositoryName}`, {
        error: error.message,
        responseTime,
        errorCount,
      });
    }

    return healthCheck;
  }

  /**
   * Get current health status (cached if recent)
   */
  async getCurrentHealthStatus(): Promise<MetricsHealthStatus> {
    const recentHealth = this.getRecentHealthStatus();
    if (recentHealth && this.isHealthStatusRecent(recentHealth)) {
      return recentHealth;
    }

    return await this.checkMetricsHealth();
  }

  /**
   * Get health history for trend analysis
   */
  getHealthHistory(limit: number = 50): MetricsHealthStatus[] {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Get repository-specific health trends
   */
  getRepositoryHealthTrends(repositoryName: string, limit: number = 20): any[] {
    return this.healthHistory.slice(-limit).map((status) => {
      const repoHealth = status.repositories.find(
        (r) => r.repository === repositoryName,
      );
      return {
        timestamp: status.timestamp,
        status: repoHealth?.status || HealthStatus.UNAVAILABLE,
        responseTime: repoHealth?.responseTime || 0,
        errorCount: repoHealth?.errorCount || 0,
      };
    });
  }

  /**
   * Check if metrics system is available for operations
   */
  async isMetricsSystemAvailable(): Promise<{
    available: boolean;
    storageType: StorageType;
    healthStatus: HealthStatus;
  }> {
    try {
      const health = await this.getCurrentHealthStatus();

      return {
        available: health.overallStatus !== HealthStatus.UNAVAILABLE,
        storageType: health.storageType,
        healthStatus: health.overallStatus,
      };
    } catch (error) {
      this.logger.error('Failed to check metrics system availability', error);
      return {
        available: false,
        storageType: StorageType.MEMORY_ONLY,
        healthStatus: HealthStatus.UNAVAILABLE,
      };
    }
  }

  /**
   * Get system degradation alerts
   */
  getSystemAlerts(): {
    critical: string[];
    warnings: string[];
    info: string[];
  } {
    const recentHealth = this.getRecentHealthStatus();
    if (!recentHealth) {
      return { critical: [], warnings: [], info: [] };
    }

    const alerts = {
      critical: [] as string[],
      warnings: [] as string[],
      info: [] as string[],
    };

    // Critical alerts
    const criticalRepos = recentHealth.repositories.filter(
      (r) => r.status === HealthStatus.CRITICAL,
    );
    for (const repo of criticalRepos) {
      alerts.critical.push(
        `Repository ${repo.repository} is in critical state: ${repo.errorMessage || 'Unknown error'}`,
      );
    }

    // Warning alerts
    const degradedRepos = recentHealth.repositories.filter(
      (r) => r.status === HealthStatus.DEGRADED,
    );
    for (const repo of degradedRepos) {
      alerts.warnings.push(
        `Repository ${repo.repository} performance degraded (${repo.responseTime}ms response time)`,
      );
    }

    const slowRepos = recentHealth.repositories.filter(
      (r) =>
        r.responseTime > this.config.responseTimeThreshold &&
        r.status === HealthStatus.HEALTHY,
    );
    for (const repo of slowRepos) {
      alerts.warnings.push(
        `Repository ${repo.repository} responding slowly (${repo.responseTime}ms)`,
      );
    }

    // Info alerts
    if (recentHealth.storageType === StorageType.MEMORY_ONLY) {
      alerts.info.push(
        'Metrics system running in memory-only mode - data will not persist',
      );
    }

    if (
      recentHealth.systemMetrics.averageResponseTime >
      this.config.responseTimeThreshold / 2
    ) {
      alerts.info.push(
        `Average response time elevated: ${recentHealth.systemMetrics.averageResponseTime}ms`,
      );
    }

    return alerts;
  }

  /**
   * Initialize error tracking for all repositories
   */
  private initializeErrorTracking(): void {
    const repositories = [
      'business-metrics',
      'financial-metrics',
      'operational-metrics',
      'shares-metrics',
    ];
    for (const repo of repositories) {
      this.repositoryErrors.set(repo, {
        count: 0,
        lastError: new Date(),
        lastMessage: '',
      });
    }
  }

  /**
   * Track errors for a specific repository
   */
  private trackRepositoryError(
    repositoryName: string,
    errorMessage: string,
  ): void {
    const current = this.repositoryErrors.get(repositoryName) || {
      count: 0,
      lastError: new Date(),
      lastMessage: '',
    };

    this.repositoryErrors.set(repositoryName, {
      count: current.count + 1,
      lastError: new Date(),
      lastMessage: errorMessage,
    });
  }

  /**
   * Determine repository status based on metrics
   */
  private determineRepositoryStatus(
    responseTime: number,
    errorCount: number,
  ): HealthStatus {
    if (errorCount >= this.config.errorCountThreshold) {
      return HealthStatus.CRITICAL;
    }

    if (responseTime > this.config.responseTimeThreshold) {
      return HealthStatus.DEGRADED;
    }

    if (responseTime > this.config.responseTimeThreshold / 2) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Calculate system-wide metrics
   */
  private calculateSystemMetrics(
    repositories: RepositoryHealthCheck[],
  ): MetricsHealthStatus['systemMetrics'] {
    const statusCounts = repositories.reduce(
      (acc, repo) => {
        acc[repo.status]++;
        return acc;
      },
      {
        [HealthStatus.HEALTHY]: 0,
        [HealthStatus.DEGRADED]: 0,
        [HealthStatus.CRITICAL]: 0,
        [HealthStatus.UNAVAILABLE]: 0,
      },
    );

    const averageResponseTime =
      repositories.reduce((sum, repo) => sum + repo.responseTime, 0) /
      repositories.length;

    return {
      totalRepositories: repositories.length,
      healthyRepositories: statusCounts[HealthStatus.HEALTHY],
      degradedRepositories: statusCounts[HealthStatus.DEGRADED],
      criticalRepositories: statusCounts[HealthStatus.CRITICAL],
      unavailableRepositories: statusCounts[HealthStatus.UNAVAILABLE],
      averageResponseTime: Math.round(averageResponseTime),
    };
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(
    repositories: RepositoryHealthCheck[],
  ): HealthStatus {
    const statuses = repositories.map((r) => r.status);

    if (statuses.every((s) => s === HealthStatus.UNAVAILABLE)) {
      return HealthStatus.UNAVAILABLE;
    }

    if (statuses.some((s) => s === HealthStatus.CRITICAL)) {
      return HealthStatus.CRITICAL;
    }

    if (statuses.some((s) => s === HealthStatus.DEGRADED)) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Determine storage type based on repository availability
   */
  private determineStorageType(
    repositories: RepositoryHealthCheck[],
  ): StorageType {
    const healthyCount = repositories.filter(
      (r) => r.status === HealthStatus.HEALTHY,
    ).length;
    const totalCount = repositories.length;

    if (healthyCount === totalCount) {
      return StorageType.PERSISTENT;
    }

    if (healthyCount === 0) {
      return StorageType.MEMORY_ONLY;
    }

    return StorageType.HYBRID;
  }

  /**
   * Generate recommendations based on health status
   */
  private generateRecommendations(
    repositories: RepositoryHealthCheck[],
  ): string[] {
    const recommendations: string[] = [];

    const criticalRepos = repositories.filter(
      (r) => r.status === HealthStatus.CRITICAL,
    );
    if (criticalRepos.length > 0) {
      recommendations.push('Investigate database connectivity issues');
      recommendations.push('Check MongoDB server health and logs');
    }

    const degradedRepos = repositories.filter(
      (r) => r.status === HealthStatus.DEGRADED,
    );
    if (degradedRepos.length > 0) {
      recommendations.push('Monitor database performance metrics');
      recommendations.push('Consider optimizing database queries and indexes');
    }

    const avgResponseTime =
      repositories.reduce((sum, r) => sum + r.responseTime, 0) /
      repositories.length;
    if (avgResponseTime > this.config.responseTimeThreshold / 2) {
      recommendations.push(
        'Review database server resources (CPU, memory, disk I/O)',
      );
    }

    if (repositories.some((r) => r.errorCount > 2)) {
      recommendations.push(
        'Review application logs for recurring error patterns',
      );
    }

    return recommendations;
  }

  /**
   * Store health status in history
   */
  private storeHealthHistory(healthStatus: MetricsHealthStatus): void {
    this.healthHistory.push(healthStatus);

    // Maintain history size limit
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Handle health status changes and emit events
   */
  private handleHealthStatusChange(healthStatus: MetricsHealthStatus): void {
    const previousStatus = this.healthHistory[this.healthHistory.length - 2];

    if (
      previousStatus &&
      previousStatus.overallStatus !== healthStatus.overallStatus
    ) {
      this.logger.log(
        `Metrics system health status changed: ${previousStatus.overallStatus} -> ${healthStatus.overallStatus}`,
      );

      this.eventEmitter.emit('metrics.health.status.changed', {
        previousStatus: previousStatus.overallStatus,
        currentStatus: healthStatus.overallStatus,
        timestamp: healthStatus.timestamp,
        repositories: healthStatus.repositories,
      });
    }

    // Emit critical alerts
    if (healthStatus.overallStatus === HealthStatus.CRITICAL) {
      this.eventEmitter.emit('metrics.health.critical', healthStatus);
      this.logger.error('CRITICAL: Metrics system in critical state', {
        repositories: healthStatus.repositories.filter(
          (r) => r.status === HealthStatus.CRITICAL,
        ),
        recommendations: healthStatus.recommendations,
      });
    }
  }

  /**
   * Get most recent health status
   */
  private getRecentHealthStatus(): MetricsHealthStatus | null {
    return this.healthHistory.length > 0
      ? this.healthHistory[this.healthHistory.length - 1]
      : null;
  }

  /**
   * Check if health status is recent (within 2 minutes)
   */
  private isHealthStatusRecent(healthStatus: MetricsHealthStatus): boolean {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    return healthStatus.timestamp > twoMinutesAgo;
  }
}
