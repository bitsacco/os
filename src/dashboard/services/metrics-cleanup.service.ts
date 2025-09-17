import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { BusinessMetricsRepository } from '../db/business-metrics.repository';
import { FinancialMetricsRepository } from '../db/financial-metrics.repository';
import { OperationalMetricsRepository } from '../db/operational-metrics.repository';
import { SharesMetricsRepository } from '../db/shares-metrics.repository';

/**
 * Data retention policies configuration
 */
export interface RetentionPolicy {
  period: 'real-time' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  retentionDays: number;
  description: string;
}

/**
 * Cleanup statistics
 */
export interface CleanupStats {
  repository: string;
  policy: RetentionPolicy;
  recordsDeleted: number;
  executionTime: number;
  success: boolean;
  error?: string;
}

/**
 * Service responsible for cleaning up old metrics data based on retention policies
 * Runs scheduled jobs to maintain database performance and storage efficiency
 */
@Injectable()
export class MetricsCleanupService {
  private readonly logger = new Logger(MetricsCleanupService.name);

  /**
   * Default retention policies as defined in the implementation plan
   */
  private readonly retentionPolicies: RetentionPolicy[] = [
    {
      period: 'real-time',
      retentionDays: 7,
      description: 'Real-time metrics kept for 7 days',
    },
    {
      period: 'hourly',
      retentionDays: 30,
      description: 'Hourly aggregates kept for 30 days',
    },
    {
      period: 'daily',
      retentionDays: 365,
      description: 'Daily aggregates kept for 1 year',
    },
    {
      period: 'weekly',
      retentionDays: 730,
      description: 'Weekly aggregates kept for 2 years',
    },
    {
      period: 'monthly',
      retentionDays: -1, // Indefinite retention
      description: 'Monthly aggregates kept indefinitely',
    },
  ];

  constructor(
    private readonly businessMetricsRepository: BusinessMetricsRepository,
    private readonly financialMetricsRepository: FinancialMetricsRepository,
    private readonly operationalMetricsRepository: OperationalMetricsRepository,
    private readonly sharesMetricsRepository: SharesMetricsRepository,
  ) {
    this.logger.log(
      'MetricsCleanupService initialized with retention policies',
    );
    this.logRetentionPolicies();
  }

  /**
   * Scheduled cleanup job that runs daily at 2 AM
   * Cleans up old metrics data across all repositories
   */
  @Cron('0 2 * * *', {
    name: 'metrics-cleanup-daily',
    timeZone: 'UTC',
  })
  async performScheduledCleanup(): Promise<void> {
    this.logger.log('Starting scheduled metrics cleanup');
    const startTime = Date.now();

    try {
      const cleanupStats = await this.cleanupAllMetrics();
      const executionTime = Date.now() - startTime;

      this.logCleanupResults(cleanupStats, executionTime);
      this.logger.log(
        `Scheduled metrics cleanup completed in ${executionTime}ms`,
      );
    } catch (error) {
      this.logger.error('Scheduled metrics cleanup failed', error);
    }
  }

  /**
   * Manual cleanup trigger for all metrics repositories
   */
  async cleanupAllMetrics(): Promise<CleanupStats[]> {
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

    const allStats: CleanupStats[] = [];

    for (const { name, repository } of repositories) {
      const stats = await this.cleanupRepository(name, repository);
      allStats.push(...stats);
    }

    return allStats;
  }

  /**
   * Cleanup a specific repository based on retention policies
   */
  async cleanupRepository(
    repositoryName: string,
    repository:
      | BusinessMetricsRepository
      | FinancialMetricsRepository
      | OperationalMetricsRepository
      | SharesMetricsRepository,
  ): Promise<CleanupStats[]> {
    const stats: CleanupStats[] = [];

    for (const policy of this.retentionPolicies) {
      // Skip indefinite retention policies
      if (policy.retentionDays === -1) {
        continue;
      }

      const startTime = Date.now();
      let stat: CleanupStats = {
        repository: repositoryName,
        policy,
        recordsDeleted: 0,
        executionTime: 0,
        success: false,
      };

      try {
        this.logger.debug(
          `Cleaning up ${repositoryName} - ${policy.period} data older than ${policy.retentionDays} days`,
        );

        const recordsDeleted = await repository.cleanupOldMetrics(
          policy.retentionDays,
        );

        stat = {
          ...stat,
          recordsDeleted,
          executionTime: Date.now() - startTime,
          success: true,
        };

        this.logger.debug(
          `Cleaned up ${recordsDeleted} records from ${repositoryName} (${policy.period})`,
        );
      } catch (error) {
        stat = {
          ...stat,
          executionTime: Date.now() - startTime,
          success: false,
          error: error.message,
        };

        this.logger.error(
          `Failed to cleanup ${repositoryName} (${policy.period})`,
          error,
        );
      }

      stats.push(stat);
    }

    return stats;
  }

  /**
   * Cleanup specific metrics type and period
   */
  async cleanupSpecificMetrics(
    repositoryName: string,
    period: string,
    retentionDays: number,
  ): Promise<CleanupStats> {
    const repository = this.getRepositoryByName(repositoryName);
    if (!repository) {
      throw new Error(`Repository '${repositoryName}' not found`);
    }

    const policy: RetentionPolicy = {
      period: period as any,
      retentionDays,
      description: `Custom cleanup for ${period} data`,
    };

    const startTime = Date.now();
    let stat: CleanupStats = {
      repository: repositoryName,
      policy,
      recordsDeleted: 0,
      executionTime: 0,
      success: false,
    };

    try {
      this.logger.log(
        `Performing custom cleanup for ${repositoryName} - ${period} data older than ${retentionDays} days`,
      );

      const recordsDeleted = await repository.cleanupOldMetrics(retentionDays);

      stat = {
        ...stat,
        recordsDeleted,
        executionTime: Date.now() - startTime,
        success: true,
      };

      this.logger.log(
        `Custom cleanup completed: ${recordsDeleted} records deleted from ${repositoryName}`,
      );
    } catch (error) {
      stat = {
        ...stat,
        executionTime: Date.now() - startTime,
        success: false,
        error: error.message,
      };

      this.logger.error(`Custom cleanup failed for ${repositoryName}`, error);
    }

    return stat;
  }

  /**
   * Get cleanup statistics summary
   */
  async getCleanupStatsSummary(): Promise<{
    totalRepositories: number;
    totalPolicies: number;
    estimatedDataSize: string;
    lastCleanupTime?: Date;
  }> {
    const repositories = [
      'business-metrics',
      'financial-metrics',
      'operational-metrics',
      'shares-metrics',
    ];

    // This would typically query actual database statistics
    // For now, return a basic summary
    return {
      totalRepositories: repositories.length,
      totalPolicies: this.retentionPolicies.filter(
        (p) => p.retentionDays !== -1,
      ).length,
      estimatedDataSize: 'Calculated from repository sizes',
      lastCleanupTime: new Date(), // Would be tracked in actual implementation
    };
  }

  /**
   * Validate retention policies configuration
   */
  validateRetentionPolicies(): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for duplicate periods
    const periods = this.retentionPolicies.map((p) => p.period);
    const duplicates = periods.filter(
      (period, index) => periods.indexOf(period) !== index,
    );
    if (duplicates.length > 0) {
      issues.push(`Duplicate periods found: ${duplicates.join(', ')}`);
    }

    // Check for logical retention progression
    const definiteRetentionPolicies = this.retentionPolicies
      .filter((p) => p.retentionDays !== -1)
      .sort((a, b) => a.retentionDays - b.retentionDays);

    for (let i = 1; i < definiteRetentionPolicies.length; i++) {
      const current = definiteRetentionPolicies[i];
      const previous = definiteRetentionPolicies[i - 1];

      if (current.retentionDays <= previous.retentionDays) {
        issues.push(
          `Retention policy logical error: ${current.period} (${current.retentionDays} days) should retain longer than ${previous.period} (${previous.retentionDays} days)`,
        );
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get repository instance by name
   */
  private getRepositoryByName(name: string): any {
    switch (name) {
      case 'business-metrics':
        return this.businessMetricsRepository;
      case 'financial-metrics':
        return this.financialMetricsRepository;
      case 'operational-metrics':
        return this.operationalMetricsRepository;
      case 'shares-metrics':
        return this.sharesMetricsRepository;
      default:
        return null;
    }
  }

  /**
   * Log retention policies on startup
   */
  private logRetentionPolicies(): void {
    this.logger.log('Configured retention policies:');
    for (const policy of this.retentionPolicies) {
      const retention =
        policy.retentionDays === -1
          ? 'indefinite'
          : `${policy.retentionDays} days`;
      this.logger.log(
        `  ${policy.period}: ${retention} - ${policy.description}`,
      );
    }
  }

  /**
   * Log cleanup results summary
   */
  private logCleanupResults(
    stats: CleanupStats[],
    totalExecutionTime: number,
  ): void {
    const successfulCleanups = stats.filter((s) => s.success);
    const failedCleanups = stats.filter((s) => !s.success);
    const totalRecordsDeleted = successfulCleanups.reduce(
      (sum, s) => sum + s.recordsDeleted,
      0,
    );

    this.logger.log('Cleanup Results Summary:');
    this.logger.log(`  Total cleanup operations: ${stats.length}`);
    this.logger.log(`  Successful operations: ${successfulCleanups.length}`);
    this.logger.log(`  Failed operations: ${failedCleanups.length}`);
    this.logger.log(`  Total records deleted: ${totalRecordsDeleted}`);
    this.logger.log(`  Total execution time: ${totalExecutionTime}ms`);

    if (failedCleanups.length > 0) {
      this.logger.warn('Failed cleanup operations:');
      for (const failed of failedCleanups) {
        this.logger.warn(
          `  ${failed.repository} (${failed.policy.period}): ${failed.error}`,
        );
      }
    }

    // Log detailed stats at debug level
    if (Logger.isLevelEnabled('debug')) {
      this.logger.debug('Detailed cleanup statistics:');
      for (const stat of stats) {
        this.logger.debug(
          `  ${stat.repository} (${stat.policy.period}): ${stat.recordsDeleted} records deleted in ${stat.executionTime}ms`,
        );
      }
    }
  }
}
