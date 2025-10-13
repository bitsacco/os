import { Injectable, Logger } from '@nestjs/common';
import { PermissionAuditRepository } from '../repositories/permission-audit.repository';
import {
  PermissionAction,
  AuditResource,
  AuditContext,
} from '../database/permission-audit-log.schema';
import { MAX_AUDIT_REASON_LENGTH } from '../constants/permissions.constants';

@Injectable()
export class PermissionAuditService {
  private readonly logger = new Logger(PermissionAuditService.name);

  constructor(
    private readonly permissionAuditRepo: PermissionAuditRepository,
  ) {}

  /**
   * Log a permission event
   */
  async log(params: {
    userId: string;
    permission: string;
    action: PermissionAction;
    result: boolean;
    resource?: AuditResource;
    reason?: string;
    context?: Partial<AuditContext>;
  }): Promise<void> {
    try {
      // M2: Sanitize reason field to prevent log injection
      const sanitizedReason = params.reason
        ?.replace(/[\n\r]/g, ' ') // Remove newlines
        ?.substring(0, MAX_AUDIT_REASON_LENGTH); // Limit length

      await this.permissionAuditRepo.log({
        userId: params.userId,
        permission: params.permission,
        action: params.action,
        result: params.result,
        resource: params.resource,
        reason: sanitizedReason,
        context: {
          endpoint: params.context?.endpoint || 'unknown',
          method: params.context?.method || 'unknown',
          ip: params.context?.ip,
          userAgent: params.context?.userAgent,
          grantedBy: params.context?.grantedBy,
          revokedBy: params.context?.revokedBy,
          resourceId: params.context?.resourceId,
        },
      });
    } catch (error) {
      // Don't fail the request if audit logging fails
      this.logger.error(`Failed to log permission audit: ${error.message}`);
    }
  }

  /**
   * Log a permission grant
   */
  async logGrant(params: {
    userId: string;
    permission: string;
    grantedBy: string;
    resourceId?: string;
    reason?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      permission: params.permission,
      action: PermissionAction.GRANTED,
      result: true,
      reason: params.reason,
      context: {
        endpoint: 'permission-grant',
        method: 'GRANT',
        grantedBy: params.grantedBy,
        resourceId: params.resourceId,
      },
    });
  }

  /**
   * Log a permission revocation
   */
  async logRevoke(params: {
    userId: string;
    permission: string;
    revokedBy: string;
    resourceId?: string;
    reason?: string;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      permission: params.permission,
      action: PermissionAction.REVOKED,
      result: true,
      reason: params.reason,
      context: {
        endpoint: 'permission-revoke',
        method: 'REVOKE',
        revokedBy: params.revokedBy,
        resourceId: params.resourceId,
      },
    });
  }

  /**
   * Log a permission check (only log denials to reduce noise)
   */
  async logCheck(params: {
    userId: string;
    permission: string;
    result: boolean;
    endpoint?: string;
    method?: string;
    resourceId?: string;
  }): Promise<void> {
    // Only log denials to reduce audit log size
    if (!params.result) {
      await this.log({
        userId: params.userId,
        permission: params.permission,
        action: PermissionAction.DENIED,
        result: false,
        reason: 'Permission denied',
        context: {
          endpoint: params.endpoint || 'unknown',
          method: params.method || 'unknown',
          resourceId: params.resourceId,
        },
      });
    }
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(userId: string, limit = 100) {
    return this.permissionAuditRepo.findByUser(userId, limit);
  }

  /**
   * Get audit logs for a permission
   */
  async getPermissionAuditLogs(permission: string, limit = 100) {
    return this.permissionAuditRepo.findByPermission(permission, limit);
  }

  /**
   * Get recent denied access attempts
   */
  async getDeniedAccessAttempts(limit = 100) {
    return this.permissionAuditRepo.findDeniedAccess(limit);
  }
}
