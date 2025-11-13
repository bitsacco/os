import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../types/auth';

/**
 * Guard to prevent suspended users from performing transactions
 * This guard should be applied to transaction endpoints to ensure
 * that users with the Suspended role cannot create or modify transactions
 */
@Injectable()
export class SuspendedUserGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user is attached, let the auth guard handle it
    if (!user) {
      return true;
    }

    // Check if user has the Suspended role
    if (user.roles && user.roles.includes(Role.Suspended)) {
      throw new ForbiddenException(
        'Account suspended. You cannot perform transactions at this time.',
      );
    }

    return true;
  }
}
