import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../types';
import { OwnershipConfig } from '../decorators/auth.decorator';

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
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
      throw new UnauthorizedException('User not authenticated');
    }

    const { paramName, idField = '_id' } = ownershipMetadata;
    const resourceId = request.params[paramName];

    if (!resourceId) return true;

    // Check if user owns the resource or is an admin
    if (user.roles && user.roles.includes(Role.Admin)) return true;
    if (user.roles && user.roles.includes(Role.SuperAdmin)) return true;

    return resourceId === user[idField].toString();
  }
}
