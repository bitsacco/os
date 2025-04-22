import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { UsersDocument } from '../database';
import { Role } from '../types';

const getCurrentUserByContext = (context: ExecutionContext): UsersDocument => {
  return context.switchToHttp().getRequest().user;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    getCurrentUserByContext(context),
);

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

/**
 * Configuration for resource ownership validation
 */
export interface OwnershipConfig {
  /** Parameter name containing the resource ID */
  paramName: string;
  /** User property to match against (defaults to '_id') */
  idField?: string;
}

/**
 * Decorator to check resource ownership
 * @param config Ownership validation configuration
 */
export const CheckOwnership = (config: OwnershipConfig) =>
  SetMetadata('ownership_check', config);
