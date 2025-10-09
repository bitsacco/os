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
import { PermissionContext } from '../services/permission-cache.service';
import { PermissionConfig } from '../decorators/permission.decorators';
import { RESOURCE_ID_REGEX } from '../constants/permissions.constants';

/**
 * Guard that checks if user has required permissions
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, PermissionGuard)
 * @RequirePermissions(['chama:update:own'])
 * async updateChama() {}
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<PermissionConfig>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('Permission check failed: User not authenticated');
      throw new UnauthorizedException('User not authenticated');
    }

    const permContext = this.extractContext(request, requiredPermissions);
    const hasPermission = await this.checkPermissions(
      user.id,
      requiredPermissions,
      permContext,
    );

    if (!hasPermission) {
      this.logger.warn(
        `Permission denied for user ${user.id}: ${requiredPermissions.permissions.join(', ')}`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    this.logger.debug(
      `Permission granted for user ${user.id}: ${requiredPermissions.permissions.join(', ')}`,
    );
    return true;
  }

  private async checkPermissions(
    userId: string,
    config: PermissionConfig,
    context?: PermissionContext,
  ): Promise<boolean> {
    const { permissions, requireAll = true } = config;

    if (!permissions || permissions.length === 0) {
      return true;
    }

    const checks = await Promise.all(
      permissions.map((p) =>
        this.permissionService.hasPermission(userId, p, context),
      ),
    );

    return requireAll
      ? checks.every((result) => result)
      : checks.some((result) => result);
  }

  private extractContext(
    request: any,
    config: PermissionConfig,
  ): PermissionContext | undefined {
    if (!config.contextField) {
      return undefined;
    }

    const resourceId =
      request.params?.[config.contextField] ||
      request.query?.[config.contextField] ||
      request.body?.[config.contextField];

    if (!resourceId) {
      return undefined;
    }

    // M4: Validate resourceId format to prevent injection
    if (typeof resourceId !== 'string') {
      this.logger.warn(`Invalid resourceId type: ${typeof resourceId}`);
      return undefined;
    }

    // Basic sanitization - UUID or MongoDB ObjectId format
    if (!RESOURCE_ID_REGEX.test(resourceId)) {
      this.logger.warn(`Invalid resourceId format: ${resourceId}`);
      return undefined;
    }

    return {
      resourceType: config.resourceType,
      resourceId,
    };
  }
}
