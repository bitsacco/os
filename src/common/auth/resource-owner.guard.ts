import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../types';
import { OwnershipConfig } from './decorators';
import * as crypto from 'crypto';

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  private readonly logger = new Logger(ResourceOwnerGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ownershipMetadata = this.reflector.get<OwnershipConfig>(
      'ownership_check',
      context.getHandler(),
    );

    if (!ownershipMetadata) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn(
        'Resource ownership check failed: User not authenticated',
      );
      throw new UnauthorizedException('User not authenticated');
    }

    const { paramName, idField = '_id' } = ownershipMetadata;
    const resourceId = request.params[paramName];

    if (!resourceId) return true;

    // Check if user owns the resource or is an admin
    if (user.roles && user.roles.includes(Role.Admin)) {
      this.logger.debug(
        `Admin access to resource ${resourceId} by user ${user.id || user._id}`,
      );
      return true;
    }

    if (user.roles && user.roles.includes(Role.SuperAdmin)) {
      this.logger.debug(
        `SuperAdmin access to resource ${resourceId} by user ${user.id || user._id}`,
      );
      return true;
    }

    // Safely extract user ID with fallback
    const userId = user[idField];
    if (!userId) {
      this.logger.warn(
        `Resource ownership check failed: User lacks ${idField} property`,
      );
      return false;
    }

    // Convert both IDs to strings for safe comparison
    const userIdStr = userId.toString();
    const resourceIdStr = resourceId.toString();

    // Use timing-safe comparison to prevent timing attacks
    try {
      const isOwner = crypto.timingSafeEqual(
        Buffer.from(userIdStr, 'utf8'),
        Buffer.from(resourceIdStr, 'utf8'),
      );

      if (!isOwner) {
        this.logger.warn(
          `Resource ownership check failed: User ${userIdStr} attempted to access resource ${resourceIdStr}`,
        );
      }

      return isOwner;
    } catch (error) {
      this.logger.error(
        `Error during resource ownership check: ${error.message}`,
      );
      return false;
    }
  }
}
