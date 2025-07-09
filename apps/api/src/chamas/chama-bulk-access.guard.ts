import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@bitsacco/common';
import { ChamasService } from './chamas.service';

/**
 * A guard that validates user access to multiple chamas in a bulk operation:
 * - Admins and SuperAdmins can access any combination of chamas
 * - Regular users can only access chamas where they are members
 * - If any chama in the list is not accessible, the entire request fails
 */
@Injectable()
export class ChamaBulkAccessGuard implements CanActivate {
  private readonly logger = new Logger(ChamaBulkAccessGuard.name);

  constructor(
    private reflector: Reflector,
    private readonly chamas: ChamasService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn(
        'Bulk chama access check failed: User not authenticated',
      );
      throw new UnauthorizedException('User not authenticated');
    }

    // If user is an admin or super admin, they have full access to all chamas
    if (
      user.roles &&
      (user.roles.includes(Role.Admin) || user.roles.includes(Role.SuperAdmin))
    ) {
      this.logger.debug(
        `Admin/SuperAdmin granted access to all chamas in bulk request`,
      );
      return true;
    }

    try {
      // For non-admin users can only access chamas they belong in.
      const knownMembership = (
        await this.chamas.filterChamas({
          memberId: user.id,
          pagination: {
            page: 0,
            size: 0, // flag to get all chama data in a single page
          },
        })
      ).chamas.map((chama) => chama.id);
      let requestedChamaIds: string[] = request.body.chamaIds || [];

      if (requestedChamaIds.length) {
        this.logger.debug(
          `Checking user membership in ${requestedChamaIds.length} chamas for bulk request`,
        );

        for (const chamaId of requestedChamaIds) {
          if (!knownMembership.includes(chamaId)) {
            this.logger.warn(
              `User ${user.id} is not a member of chama ${chamaId} - denying bulk access`,
            );
            return false;
          }
        }
      } else {
        // allow non-admin user to bulk aggregate chamas they belong to
        request.body.chamaIds = knownMembership;
        requestedChamaIds = knownMembership;
      }

      // User is a member of all requested chamas
      this.logger.debug(
        `User ${user.id} is a member of all chamas in the bulk request`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error during bulk chama access check: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
