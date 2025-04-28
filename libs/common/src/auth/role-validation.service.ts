import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { Role, User } from '../types';

@Injectable()
export class RoleValidationService {
  private readonly logger = new Logger(RoleValidationService.name);

  /**
   * Validates role updates to enforce role promotion rules
   * @param requestingUser User making the request
   * @param targetUserId ID of the user being updated
   * @param currentRoles Current roles of the target user
   * @param newRoles New roles being assigned
   * @throws ForbiddenException if the role update violates promotion rules
   */
  validateRoleUpdate(
    requestingUser: User,
    targetUserId: string,
    currentRoles: Role[],
    newRoles: Role[],
  ): void {
    // If roles aren't changing, no validation needed
    if (
      currentRoles.length === newRoles.length &&
      currentRoles.every((r, i) => r === newRoles[i])
    ) {
      return;
    }

    this.logger.debug(
      `Validating role update from ${currentRoles} to ${newRoles} by user ${requestingUser.id}`,
    );

    const isSelfUpdate = requestingUser.id === targetUserId;
    const hasAdminRole = requestingUser.roles.includes(Role.Admin);
    const hasSuperAdminRole = requestingUser.roles.includes(Role.SuperAdmin);
    const isAddingSuperAdmin =
      !currentRoles.includes(Role.SuperAdmin) &&
      newRoles.includes(Role.SuperAdmin);
    const isAddingAdmin =
      !currentRoles.includes(Role.Admin) && newRoles.includes(Role.Admin);

    // Rule 1: Prevent Member from elevating themselves to Admin
    if (isSelfUpdate && !hasAdminRole && !hasSuperAdminRole && isAddingAdmin) {
      this.logger.warn(
        `User ${requestingUser.id} attempted to elevate themselves to Admin`,
      );
      throw new ForbiddenException(
        'Members cannot promote themselves to Admin role',
      );
    }

    // Rule 2: Prevent Admin from promoting any user to SuperAdmin
    if (hasAdminRole && !hasSuperAdminRole && isAddingSuperAdmin) {
      this.logger.warn(
        `Admin user ${requestingUser.id} attempted to promote user ${targetUserId} to SuperAdmin`,
      );
      throw new ForbiddenException(
        'Admin users cannot promote to SuperAdmin role',
      );
    }

    // Rule 3: Only SuperAdmin can grant SuperAdmin privileges
    if (isAddingSuperAdmin && !hasSuperAdminRole) {
      this.logger.warn(
        `User ${requestingUser.id} attempted to promote user ${targetUserId} to SuperAdmin without SuperAdmin privileges`,
      );
      throw new ForbiddenException(
        'Only SuperAdmin users can grant SuperAdmin privileges',
      );
    }
  }
}
