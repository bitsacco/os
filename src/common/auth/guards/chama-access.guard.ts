import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../services/permission.service';
import {
  ChamaAccessLevel,
  ChamaAccessConfig,
} from '../decorators/permission.decorators';

/**
 * Enhanced Chama Access Guard with tiered access levels
 *
 * Access Levels:
 * - NONE: No access
 * - PREVIEW_INVITED: Can preview chama (invitees only)
 * - FULL_MEMBER: Full member access
 * - FULL_ADMIN: Admin access (chama admin or platform admin)
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, ChamaAccessGuard)
 * @RequireChamaAccess(ChamaAccessLevel.PREVIEW_INVITED)
 * async getChamaPreview() {}
 */
@Injectable()
export class ChamaAccessGuard implements CanActivate {
  private readonly logger = new Logger(ChamaAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<ChamaAccessConfig>(
      'chama_access',
      context.getHandler(),
    );

    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('Chama access check failed: User not authenticated');
      throw new UnauthorizedException('User not authenticated');
    }

    const chamaId = request.params?.[config.chamaIdField];
    if (!chamaId) {
      this.logger.warn(
        `Chama ID field '${config.chamaIdField}' not found in request params`,
      );
      // CQ1: Throw exception for consistency across guards
      throw new ForbiddenException('Invalid chama access request');
    }

    const accessLevel = await this.determineAccessLevel(user.id, chamaId);
    request.chamaAccessLevel = accessLevel; // Attach to request for use in controller

    const meetsRequirement = this.meetsRequirement(
      accessLevel,
      config.requiredLevel,
    );

    if (!meetsRequirement) {
      this.logger.warn(
        `Chama access denied for user ${user.id}: has ${accessLevel}, requires ${config.requiredLevel}`,
      );
      throw new ForbiddenException('Insufficient access to this chama');
    }

    this.logger.debug(
      `Chama access granted for user ${user.id}: ${accessLevel} >= ${config.requiredLevel}`,
    );
    return true;
  }

  /**
   * Determine the user's access level to a chama
   */
  private async determineAccessLevel(
    userId: string,
    chamaId: string,
  ): Promise<ChamaAccessLevel> {
    // Level 1: Platform admin (highest)
    const hasAdminAccess = await this.permissionService.hasPermission(
      userId,
      'chama:read:any',
    );
    if (hasAdminAccess) {
      this.logger.debug(
        `User ${userId} has platform admin access to chama ${chamaId}`,
      );
      return ChamaAccessLevel.FULL_ADMIN;
    }

    // Level 2: Chama member (check resource-specific permission)
    const hasMemberAccess = await this.permissionService.hasPermission(
      userId,
      'chama:read:own',
      { resourceType: 'chama', resourceId: chamaId },
    );

    if (hasMemberAccess) {
      // Check if user is chama admin
      const isChamaAdmin = await this.permissionService.hasPermission(
        userId,
        'chama:update:own',
        { resourceType: 'chama', resourceId: chamaId },
      );

      this.logger.debug(
        `User ${userId} is ${isChamaAdmin ? 'admin' : 'member'} of chama ${chamaId}`,
      );
      return isChamaAdmin
        ? ChamaAccessLevel.FULL_ADMIN
        : ChamaAccessLevel.FULL_MEMBER;
    }

    // Level 3: Invitee (preview access)
    const hasInviteAccess = await this.permissionService.hasPermission(
      userId,
      'chama:read:invited',
      { resourceType: 'chama', resourceId: chamaId },
    );

    if (hasInviteAccess) {
      this.logger.debug(
        `User ${userId} has invite preview access to chama ${chamaId}`,
      );
      return ChamaAccessLevel.PREVIEW_INVITED;
    }

    // No access
    this.logger.debug(`User ${userId} has no access to chama ${chamaId}`);
    return ChamaAccessLevel.NONE;
  }

  /**
   * Check if actual access level meets the required level
   */
  private meetsRequirement(
    actual: ChamaAccessLevel,
    required: ChamaAccessLevel,
  ): boolean {
    const levels = [
      ChamaAccessLevel.NONE,
      ChamaAccessLevel.PREVIEW_INVITED,
      ChamaAccessLevel.FULL_MEMBER,
      ChamaAccessLevel.FULL_ADMIN,
    ];

    const actualIndex = levels.indexOf(actual);
    const requiredIndex = levels.indexOf(required);

    return actualIndex >= requiredIndex;
  }
}
