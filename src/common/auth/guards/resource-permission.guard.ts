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
import { ResourcePermissionConfig } from '../decorators/permission.decorators';
import * as crypto from 'crypto';

/**
 * Guard that checks resource ownership permissions
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, ResourcePermissionGuard)
 * @RequireResourceOwnership('user', 'update', 'userId')
 * async updateUser(@Param('userId') userId: string) {}
 */
@Injectable()
export class ResourcePermissionGuard implements CanActivate {
  private readonly logger = new Logger(ResourcePermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<ResourcePermissionConfig>(
      'resource_permission',
      context.getHandler(),
    );

    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn(
        'Resource permission check failed: User not authenticated',
      );
      throw new UnauthorizedException('User not authenticated');
    }

    const resourceId = request.params[config.paramName];

    if (!resourceId) {
      // No resource ID means check passes (may be create operation)
      return true;
    }

    // Check ownership permission
    const ownsResource = this.checkOwnership(user, resourceId, config);
    if (ownsResource) {
      const hasOwnPermission = await this.permissionService.hasPermission(
        user.id,
        config.ownPermission,
      );

      if (hasOwnPermission) {
        this.logger.debug(
          `Resource ownership permission granted for user ${user.id}: ${config.ownPermission}`,
        );
        return true;
      }
    }

    // Check admin permission
    if (config.anyPermission) {
      const hasAnyPermission = await this.permissionService.hasPermission(
        user.id,
        config.anyPermission,
      );

      if (hasAnyPermission) {
        this.logger.debug(
          `Admin permission granted for user ${user.id}: ${config.anyPermission}`,
        );
        return true;
      }
    }

    this.logger.warn(
      `Resource permission denied for user ${user.id} on resource ${resourceId}`,
    );
    throw new ForbiddenException(
      'Insufficient permissions to access this resource',
    );
  }

  private checkOwnership(
    user: any,
    resourceId: string,
    config: ResourcePermissionConfig,
  ): boolean {
    const userId = user[config.userIdField || 'id'];

    // H3: Sanitize error messages to prevent information disclosure
    if (!userId) {
      this.logger.warn('Resource ownership check failed: Invalid user context');
      return false;
    }

    // Convert both IDs to strings for safe comparison
    const userIdStr = userId.toString();
    const resourceIdStr = resourceId.toString();

    // Use timing-safe comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(userIdStr, 'utf8'),
        Buffer.from(resourceIdStr, 'utf8'),
      );
    } catch {
      // Buffers must be same length for timingSafeEqual
      // If they're different lengths, they're not equal
      return false;
    }
  }
}
