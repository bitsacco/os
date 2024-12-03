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
