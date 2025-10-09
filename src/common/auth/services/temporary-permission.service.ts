import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserPermissionRepository } from '../repositories/user-permission.repository';
import { TemporaryPermission } from '../database/user-permission.schema';

@Injectable()
export class TemporaryPermissionService {
  private readonly logger = new Logger(TemporaryPermissionService.name);

  constructor(
    private readonly userPermissionRepo: UserPermissionRepository,
    // M5: Removed REQUEST-scoped cache service injection (scope mismatch)
    // Cache invalidation is handled by PermissionService
  ) {}

  /**
   * Grant a temporary permission
   */
  async grant(
    userId: string,
    permission: string,
    duration: number, // milliseconds
    grantedBy: string,
    reason?: string,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + duration);

    await this.userPermissionRepo.addTemporaryPermission(userId, {
      permission,
      expiresAt,
      grantedBy,
      reason,
    });

    // M5: Cache invalidation handled by PermissionService (removed cache service)

    this.logger.log(
      `Granted temporary permission ${permission} to user ${userId} until ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Revoke a temporary permission
   */
  async revoke(userId: string, permission: string): Promise<void> {
    await this.userPermissionRepo.removeTemporaryPermission(userId, permission);

    // M5: Cache invalidation handled by PermissionService (removed cache service)

    this.logger.log(
      `Revoked temporary permission ${permission} for user ${userId}`,
    );
  }

  /**
   * Get active temporary permissions for a user
   */
  async getActive(userId: string): Promise<TemporaryPermission[]> {
    const userPerms = await this.userPermissionRepo.findByUserId(userId);

    if (!userPerms) {
      return [];
    }

    const now = new Date();
    return (userPerms.temporaryPermissions || []).filter(
      (tp) => tp.expiresAt > now,
    );
  }

  /**
   * Check if user has a specific active temporary permission
   */
  async hasTemporaryPermission(
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const activePerms = await this.getActive(userId);
    return activePerms.some((tp) => tp.permission === permission);
  }

  /**
   * Cleanup expired temporary permissions
   * Runs every hour
   *
   * M3: Note on cache invalidation:
   * We don't invalidate REQUEST-scoped cache from this cron job because:
   * 1. Cache scope mismatch - cron runs outside request context
   * 2. The hasTemporaryPermission check already validates expiration
   * 3. Cache entries naturally expire with request lifecycle
   * This is safe and prevents scope-related issues.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpired(): Promise<void> {
    try {
      const count =
        await this.userPermissionRepo.removeExpiredTemporaryPermissions();

      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired temporary permissions`);
      }
    } catch (error) {
      this.logger.error(
        `Error cleaning up expired permissions: ${error.message}`,
      );
    }
  }

  /**
   * Grant temporary permission for a specific duration in hours
   */
  async grantForHours(
    userId: string,
    permission: string,
    hours: number,
    grantedBy: string,
    reason?: string,
  ): Promise<void> {
    const duration = hours * 60 * 60 * 1000; // Convert hours to milliseconds
    await this.grant(userId, permission, duration, grantedBy, reason);
  }

  /**
   * Grant temporary permission for a specific duration in days
   */
  async grantForDays(
    userId: string,
    permission: string,
    days: number,
    grantedBy: string,
    reason?: string,
  ): Promise<void> {
    const duration = days * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    await this.grant(userId, permission, duration, grantedBy, reason);
  }
}
