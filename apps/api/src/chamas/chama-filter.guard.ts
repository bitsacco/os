import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@bitsacco/common';

/**
 * A guard that restricts chama filtering based on user role:
 * - Admins and SuperAdmins can filter all chamas
 * - Regular users can only filter chamas where they are members
 */
@Injectable()
export class ChamaFilterGuard implements CanActivate {
  private readonly logger = new Logger(ChamaFilterGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('User not authenticated');
      return false;
    }

    // Admin and SuperAdmin can filter all chamas
    if (
      user.roles &&
      (user.roles.includes(Role.Admin) || user.roles.includes(Role.SuperAdmin))
    ) {
      this.logger.debug(`Admin/SuperAdmin access to filter all chamas`);
      return true;
    }

    // Non-admin users must specify their userId as memberId parameter
    const { memberId } = request.query;

    if (memberId && memberId !== user.id) {
      this.logger.warn(
        `User ${user.id} attempted to filter chamas for a different user ${memberId}`,
      );
      // This is a scope breach we should prevent
      return false;
    }

    if (!memberId) {
      // Force set memberId to user.id to ensure they can only see their own chamas
      this.logger.debug(`Setting memberId filter to user.id ${user.id}`);
      request.query.memberId = user.id;
      this.logger.debug(
        `Updated query params: ${JSON.stringify(request.query)}`,
      );
    }

    return true;
  }
}
