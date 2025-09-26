import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WithdrawalRateLimit,
  WithdrawalRateLimitDocument,
} from './withdrawal-rate-limit.schema';

/**
 * Repository for managing withdrawal rate limit data in MongoDB.
 */
@Injectable()
export class WithdrawalRateLimitRepository {
  private readonly logger = new Logger(WithdrawalRateLimitRepository.name);

  constructor(
    @InjectModel(WithdrawalRateLimit.name)
    private readonly rateLimitModel: Model<WithdrawalRateLimitDocument>,
  ) {}

  /**
   * Get user rate limits from database.
   *
   * @param userId User ID
   * @returns User rate limits or null if not found
   */
  async getUserLimits(
    userId: string,
  ): Promise<WithdrawalRateLimitDocument | null> {
    try {
      return await this.rateLimitModel.findOne({ userId }).exec();
    } catch (error) {
      this.logger.error(`Error getting rate limits for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Save or update user rate limits.
   *
   * @param limits User rate limits to save
   * @returns Saved document
   */
  async saveUserLimits(limits: {
    userId: string;
    daily: {
      count: number;
      totalSats: number;
      resetAt: Date;
    };
    hourly: {
      count: number;
      totalSats: number;
      resetAt: Date;
    };
    burst: {
      count: number;
      resetAt: Date;
    };
    blockedUntil?: Date;
    suspiciousActivity: number;
  }): Promise<WithdrawalRateLimitDocument> {
    try {
      const now = new Date();

      // Add recent attempt to history
      const recentAttempt = {
        timestamp: now,
        amountSats: 0, // Will be updated by the service
        type: 'UPDATE',
        blocked: !!limits.blockedUntil && limits.blockedUntil > now,
        reason: limits.blockedUntil ? 'Rate limit exceeded' : undefined,
      };

      const result = await this.rateLimitModel
        .findOneAndUpdate(
          { userId: limits.userId },
          {
            $set: {
              daily: limits.daily,
              hourly: limits.hourly,
              burst: limits.burst,
              blockedUntil: limits.blockedUntil,
              suspiciousActivity: limits.suspiciousActivity,
              lastWithdrawalAt: now,
            },
            $push: {
              recentAttempts: {
                $each: [recentAttempt],
                $slice: -100, // Keep only last 100 attempts
              },
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
          },
        )
        .exec();

      return result;
    } catch (error) {
      this.logger.error(
        `Error saving rate limits for user ${limits.userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete user rate limits.
   *
   * @param userId User ID
   * @returns True if deleted, false otherwise
   */
  async deleteUserLimits(userId: string): Promise<boolean> {
    try {
      const result = await this.rateLimitModel.deleteOne({ userId }).exec();
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(
        `Error deleting rate limits for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get users who are currently blocked.
   *
   * @returns List of blocked users
   */
  async getBlockedUsers(): Promise<WithdrawalRateLimitDocument[]> {
    try {
      const now = new Date();
      return await this.rateLimitModel
        .find({
          blockedUntil: { $gt: now },
        })
        .sort({ blockedUntil: -1 })
        .exec();
    } catch (error) {
      this.logger.error('Error getting blocked users:', error);
      return [];
    }
  }

  /**
   * Get users with suspicious activity.
   *
   * @param minSuspiciousCount Minimum suspicious activity count
   * @returns List of users with suspicious activity
   */
  async getSuspiciousUsers(
    minSuspiciousCount = 5,
  ): Promise<WithdrawalRateLimitDocument[]> {
    try {
      return await this.rateLimitModel
        .find({
          suspiciousActivity: { $gte: minSuspiciousCount },
        })
        .sort({ suspiciousActivity: -1 })
        .exec();
    } catch (error) {
      this.logger.error('Error getting suspicious users:', error);
      return [];
    }
  }

  /**
   * Reset suspicious activity count for a user.
   *
   * @param userId User ID
   * @returns True if reset, false otherwise
   */
  async resetSuspiciousActivity(userId: string): Promise<boolean> {
    try {
      const result = await this.rateLimitModel
        .updateOne({ userId }, { $set: { suspiciousActivity: 0 } })
        .exec();
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(
        `Error resetting suspicious activity for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get rate limit statistics for monitoring.
   *
   * @returns Statistics object
   */
  async getStatistics(): Promise<{
    totalUsers: number;
    blockedUsers: number;
    suspiciousUsers: number;
    recentlyActive: number;
  }> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [total, blocked, suspicious, recent] = await Promise.all([
        this.rateLimitModel.countDocuments().exec(),
        this.rateLimitModel
          .countDocuments({ blockedUntil: { $gt: now } })
          .exec(),
        this.rateLimitModel
          .countDocuments({ suspiciousActivity: { $gte: 5 } })
          .exec(),
        this.rateLimitModel
          .countDocuments({ lastWithdrawalAt: { $gte: oneHourAgo } })
          .exec(),
      ]);

      return {
        totalUsers: total,
        blockedUsers: blocked,
        suspiciousUsers: suspicious,
        recentlyActive: recent,
      };
    } catch (error) {
      this.logger.error('Error getting rate limit statistics:', error);
      return {
        totalUsers: 0,
        blockedUsers: 0,
        suspiciousUsers: 0,
        recentlyActive: 0,
      };
    }
  }

  /**
   * Clean up expired rate limit records.
   *
   * @returns Number of deleted records
   */
  async cleanupExpired(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await this.rateLimitModel
        .deleteMany({
          updatedAt: { $lt: thirtyDaysAgo },
          suspiciousActivity: 0,
          blockedUntil: { $exists: false },
        })
        .exec();

      if (result.deletedCount > 0) {
        this.logger.log(
          `Cleaned up ${result.deletedCount} expired rate limit records`,
        );
      }

      return result.deletedCount;
    } catch (error) {
      this.logger.error('Error cleaning up expired rate limit records:', error);
      return 0;
    }
  }
}
