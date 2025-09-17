import { Logger } from '@nestjs/common';
import { FilterQuery, UpdateQuery } from 'mongoose';
import { AbstractRepository } from './abstract.repository';
import { BaseMetricsDocument } from './metrics.schema';

/**
 * Base repository class for all metrics collections
 * Provides common persistence operations and period-based aggregation methods
 */
export abstract class BaseMetricsRepository<
  T extends BaseMetricsDocument,
> extends AbstractRepository<T> {
  protected abstract readonly logger: Logger;

  /**
   * Store current metrics, using upsert to overwrite existing metrics for the current period
   * This ensures we maintain one record per period per source
   */
  async storeCurrentMetrics(
    metrics: Omit<T, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<T> {
    const periodStart = this.getPeriodStart(metrics.period);
    const periodEnd = this.getPeriodEnd(metrics.period);

    try {
      // Try to update existing record for this period
      const existing = await this.findOneAndUpdateAtomic(
        {
          period: metrics.period,
          source: metrics.source,
          timestamp: {
            $gte: periodStart,
            $lt: periodEnd,
          },
        } as FilterQuery<T>,
        metrics as UpdateQuery<T>,
        { returnDocument: 'after', throwIfNotFound: false },
      );

      if (existing) {
        return existing;
      }

      // If no existing record, create new one
      return await this.create(metrics);
    } catch (error) {
      this.logger.error('Failed to store metrics', {
        source: metrics.source,
        period: metrics.period,
        error,
      });
      throw error;
    }
  }

  /**
   * Get metrics for a specific time range
   */
  async getMetricsForRange(
    source: string,
    period: string,
    startDate: Date,
    endDate: Date,
  ): Promise<T[]> {
    try {
      return await this.find(
        {
          source,
          period,
          timestamp: { $gte: startDate, $lte: endDate },
        } as FilterQuery<T>,
        { timestamp: -1 },
      );
    } catch (error) {
      this.logger.error('Failed to get metrics for range', {
        source,
        period,
        startDate,
        endDate,
        error,
      });
      return [];
    }
  }

  /**
   * Get the latest metrics for a specific source and period
   */
  async getLatestMetrics(source: string, period: string): Promise<T | null> {
    try {
      const results = await this.find({ source, period } as FilterQuery<T>, {
        timestamp: -1,
      });
      return results[0] || null;
    } catch (error) {
      this.logger.error('Failed to get latest metrics', {
        source,
        period,
        error,
      });
      return null;
    }
  }

  /**
   * Get trend data for the last N days
   */
  async getTrendData(
    source: string,
    period: string,
    days: number,
  ): Promise<T[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    try {
      return await this.getMetricsForRange(source, period, startDate, endDate);
    } catch (error) {
      this.logger.error('Failed to get trend data', {
        source,
        period,
        days,
        error,
      });
      return [];
    }
  }

  /**
   * Cleanup old metrics based on retention policy
   */
  async cleanupOldMetrics(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );

    try {
      const result = await this.model.deleteMany({
        timestamp: { $lt: cutoffDate },
      });

      this.logger.log(
        `Cleaned up ${result.deletedCount} old metrics records older than ${retentionDays} days`,
      );

      return result.deletedCount || 0;
    } catch (error) {
      this.logger.error('Failed to cleanup old metrics', {
        retentionDays,
        cutoffDate,
        error,
      });
      return 0;
    }
  }

  /**
   * Get aggregated metrics using MongoDB aggregation pipeline
   */
  async getAggregatedMetrics(
    source: string,
    period: string,
    aggregationPipeline: any[],
  ): Promise<any[]> {
    try {
      const pipeline = [
        {
          $match: {
            source,
            period,
          },
        },
        ...aggregationPipeline,
      ];

      return await this.aggregate(pipeline);
    } catch (error) {
      this.logger.error('Failed to get aggregated metrics', {
        source,
        period,
        error,
      });
      return [];
    }
  }

  /**
   * Check if database connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.model.findOne().limit(1).lean();
      return true;
    } catch (error) {
      this.logger.error('Metrics repository health check failed', error);
      return false;
    }
  }

  /**
   * Get the start time of a period based on current time
   */
  private getPeriodStart(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'hourly':
        return new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours(),
        );
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'weekly':
        return new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - now.getDay(),
        );
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'real-time':
      default:
        return new Date();
    }
  }

  /**
   * Get the end time of a period based on period start
   */
  private getPeriodEnd(period: string): Date {
    const start = this.getPeriodStart(period);
    switch (period) {
      case 'hourly':
        return new Date(start.getTime() + 60 * 60 * 1000);
      case 'daily':
        return new Date(start.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(start.getFullYear(), start.getMonth() + 1, 1);
      case 'real-time':
      default:
        return new Date(Date.now() + 60 * 1000); // 1 minute window for real-time
    }
  }
}
