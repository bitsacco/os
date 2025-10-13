import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PermissionRepository } from '../repositories/permission.repository';
import { UserPermissionRepository } from '../repositories/user-permission.repository';
import { RolePermissionRepository } from '../repositories/role-permission.repository';
import {
  PermissionCacheService,
  PermissionContext,
} from './permission-cache.service';
import { PermissionAuditService } from './permission-audit.service';
import {
  PERMISSION_REGEX,
  PERMISSION_VALIDATION_ERRORS,
} from '../constants/permissions.constants';

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    private readonly permissionRepo: PermissionRepository,
    private readonly userPermissionRepo: UserPermissionRepository,
    private readonly rolePermissionRepo: RolePermissionRepository,
    private readonly cacheService: PermissionCacheService,
    private readonly auditService: PermissionAuditService,
  ) {}

  /**
   * Check if user has permission
   */
  async hasPermission(
    userId: string,
    permission: string,
    context?: PermissionContext,
  ): Promise<boolean> {
    try {
      // 1. Check cache first
      const cached = this.cacheService.get(userId, permission, context);
      if (cached !== null) {
        return cached;
      }

      // 2. Check explicit denials (highest priority)
      const isDenied = await this.isDenied(userId, permission);
      if (isDenied) {
        this.cacheService.set(userId, permission, false, context);
        await this.auditService.logCheck({
          userId,
          permission,
          result: false,
        });
        return false;
      }

      // 3. Check temporary permissions
      const hasTemporary = await this.hasTemporaryPermission(
        userId,
        permission,
      );
      if (hasTemporary) {
        this.cacheService.set(userId, permission, true, context);
        return true;
      }

      // 4. Check user-specific permissions
      const hasUserPermission = await this.hasUserPermission(
        userId,
        permission,
        context,
      );
      if (hasUserPermission) {
        this.cacheService.set(userId, permission, true, context);
        return true;
      }

      // 5. Check role-based permissions
      const hasRolePermission = await this.hasRolePermission(
        userId,
        permission,
      );
      if (hasRolePermission) {
        this.cacheService.set(userId, permission, true, context);
        return true;
      }

      // 6. Check wildcard permissions
      const hasWildcard = await this.hasWildcardPermission(userId, permission);
      if (hasWildcard) {
        this.cacheService.set(userId, permission, true, context);
        return true;
      }

      // No permission found
      this.cacheService.set(userId, permission, false, context);
      await this.auditService.logCheck({
        userId,
        permission,
        result: false,
      });
      return false;
    } catch (error) {
      this.logger.error(`Permission check failed: ${error.message}`);
      // Fail secure - deny permission on error
      return false;
    }
  }

  /**
   * Check if permission is explicitly denied
   */
  private async isDenied(userId: string, permission: string): Promise<boolean> {
    const userPerms = await this.userPermissionRepo.findByUserId(userId);
    if (!userPerms) return false;

    return (userPerms.deniedPermissions || []).includes(permission);
  }

  /**
   * Check if user has temporary permission
   */
  private async hasTemporaryPermission(
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const userPerms = await this.userPermissionRepo.findByUserId(userId);
    if (!userPerms) return false;

    const now = new Date();
    return (userPerms.temporaryPermissions || []).some(
      (tp) => tp.permission === permission && tp.expiresAt > now,
    );
  }

  /**
   * Check if user has user-specific permission
   */
  private async hasUserPermission(
    userId: string,
    permission: string,
    context?: PermissionContext,
  ): Promise<boolean> {
    const userPerms = await this.userPermissionRepo.findByUserId(userId);
    if (!userPerms) return false;

    // Check global permissions
    if ((userPerms.permissions || []).includes(permission)) {
      return true;
    }

    // Check resource-specific permissions
    if (context?.resourceId) {
      const chamaPerms = (userPerms.chamaPermissions || []).find(
        (cp) => cp.chamaId === context.resourceId,
      );

      if (chamaPerms && chamaPerms.permissions.includes(permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user has permission through roles
   * Uses batch fetching to avoid N+1 query problem
   */
  private async hasRolePermission(
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const userPerms = await this.userPermissionRepo.findByUserId(userId);
    if (!userPerms || !userPerms.inheritedFromRoles?.length) return false;

    // Fix N+1: Batch fetch all role permissions at once
    const rolePermissions = await this.rolePermissionRepo.findByRoles(
      userPerms.inheritedFromRoles,
    );

    // Check if any role has the permission
    for (const rolePerms of rolePermissions) {
      if (rolePerms.permissions.includes(permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user has wildcard permission
   */
  private async hasWildcardPermission(
    userId: string,
    permission: string,
  ): Promise<boolean> {
    // H2: Validate permission format to prevent NoSQL injection
    if (!PERMISSION_REGEX.PARTIAL.test(permission)) {
      this.logger.warn(
        `Invalid permission format in wildcard check: ${permission}`,
      );
      return false;
    }

    const userPerms = await this.userPermissionRepo.findByUserId(userId);
    if (!userPerms) return false;

    // Check for * (all permissions)
    if ((userPerms.permissions || []).includes('*')) {
      return true;
    }

    // Check for category wildcards (e.g., admin:*)
    const parts = permission.split(':');
    if (parts.length > 1) {
      const categoryWildcard = `${parts[0]}:*`;
      if ((userPerms.permissions || []).includes(categoryWildcard)) {
        return true;
      }
    }

    // Check role-based wildcards (use batch fetching to avoid N+1)
    if (userPerms.inheritedFromRoles?.length) {
      const rolePermissions = await this.rolePermissionRepo.findByRoles(
        userPerms.inheritedFromRoles,
      );

      for (const rolePerms of rolePermissions) {
        if (rolePerms.permissions.includes('*')) {
          return true;
        }

        if (parts.length > 1) {
          const categoryWildcard = `${parts[0]}:*`;
          if (rolePerms.permissions.includes(categoryWildcard)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Grant permission to user
   */
  async grantPermission(
    userId: string,
    permission: string,
    grantedBy: string,
    options?: {
      resourceId?: string;
      expiresAt?: Date;
      reason?: string;
    },
  ): Promise<void> {
    // H2: Validate permission format to prevent NoSQL injection
    if (!PERMISSION_REGEX.FULL.test(permission)) {
      throw new BadRequestException(
        `${PERMISSION_VALIDATION_ERRORS.INVALID_FORMAT}: ${permission}`,
      );
    }

    // Validate permission exists (except for wildcards)
    if (permission !== '*' && !permission.endsWith(':*')) {
      const permissionDef =
        await this.permissionRepo.findByPermission(permission);
      if (!permissionDef) {
        throw new BadRequestException(
          `${PERMISSION_VALIDATION_ERRORS.UNKNOWN_PERMISSION}: ${permission}`,
        );
      }
    }

    // H1: Clear cache BEFORE database update to prevent race condition
    this.cacheService.invalidate(userId);

    // Update database
    if (options?.expiresAt) {
      // Grant temporary permission
      await this.userPermissionRepo.addTemporaryPermission(userId, {
        permission,
        expiresAt: options.expiresAt,
        grantedBy,
        reason: options.reason,
      });
    } else if (options?.resourceId) {
      // Grant resource-specific permission
      await this.userPermissionRepo.addChamaPermissions(
        userId,
        options.resourceId,
        [permission],
      );
    } else {
      // Grant global permission
      await this.userPermissionRepo.addPermission(userId, permission);
    }

    // Audit log (after DB update)
    await this.auditService.logGrant({
      userId,
      permission,
      grantedBy,
      resourceId: options?.resourceId,
      reason: options?.reason,
    });

    this.logger.log(
      `Granted permission ${permission} to user ${userId} by ${grantedBy}`,
    );
  }

  /**
   * Revoke permission from user
   */
  async revokePermission(
    userId: string,
    permission: string,
    revokedBy: string,
    resourceId?: string,
  ): Promise<void> {
    // H1: Clear cache BEFORE database update to prevent race condition
    this.cacheService.invalidate(userId);

    // Update database
    if (resourceId) {
      await this.userPermissionRepo.removeResourcePermission(
        userId,
        resourceId,
        permission,
      );
    } else {
      await this.userPermissionRepo.removePermission(userId, permission);
    }

    // Audit log (after DB update)
    await this.auditService.logRevoke({
      userId,
      permission,
      revokedBy,
      resourceId,
    });

    this.logger.log(
      `Revoked permission ${permission} from user ${userId} by ${revokedBy}`,
    );
  }

  /**
   * Batch permission check (requireAll = true means AND, false means OR)
   */
  async hasPermissions(
    userId: string,
    permissions: string[],
    requireAll = false,
  ): Promise<boolean> {
    const checks = await Promise.all(
      permissions.map((p) => this.hasPermission(userId, p)),
    );

    return requireAll
      ? checks.every((result) => result === true)
      : checks.some((result) => result === true);
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<{
    direct: string[];
    inherited: string[];
    temporary: string[];
    denied: string[];
    chamaPermissions: Array<{ chamaId: string; permissions: string[] }>;
  }> {
    const userPerms = await this.userPermissionRepo.findByUserId(userId);

    if (!userPerms) {
      return {
        direct: [],
        inherited: [],
        temporary: [],
        denied: [],
        chamaPermissions: [],
      };
    }

    // Get inherited permissions from roles (use batch fetching to avoid N+1)
    const inherited: string[] = [];
    if (userPerms.inheritedFromRoles?.length) {
      const rolePermissions = await this.rolePermissionRepo.findByRoles(
        userPerms.inheritedFromRoles,
      );
      for (const rolePerms of rolePermissions) {
        inherited.push(...rolePerms.permissions);
      }
    }

    // Get active temporary permissions
    const now = new Date();
    const temporary = (userPerms.temporaryPermissions || [])
      .filter((tp) => tp.expiresAt > now)
      .map((tp) => tp.permission);

    return {
      direct: userPerms.permissions || [],
      inherited: [...new Set(inherited)],
      temporary,
      denied: userPerms.deniedPermissions || [],
      chamaPermissions: userPerms.chamaPermissions || [],
    };
  }

  /**
   * Deny a specific permission for a user
   */
  async denyPermission(
    userId: string,
    permission: string,
    deniedBy: string,
  ): Promise<void> {
    // H1: Clear cache BEFORE database update to prevent race condition
    this.cacheService.invalidate(userId);

    // Update database
    await this.userPermissionRepo.addDeniedPermission(userId, permission);

    this.logger.log(
      `Denied permission ${permission} for user ${userId} by ${deniedBy}`,
    );
  }

  /**
   * Remove denial of a permission
   */
  async removeDenial(userId: string, permission: string): Promise<void> {
    // H1: Clear cache BEFORE database update to prevent race condition
    this.cacheService.invalidate(userId);

    // Update database
    await this.userPermissionRepo.removeDeniedPermission(userId, permission);

    this.logger.log(
      `Removed denial of permission ${permission} for user ${userId}`,
    );
  }
}
