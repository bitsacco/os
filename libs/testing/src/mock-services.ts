import { Injectable } from '@nestjs/common';
import { Role } from '@bitsacco/common';

// Mock RoleValidationService for testing
@Injectable()
export class MockRoleValidationService {
  validateRoleUpdate(
    requestingUser: any,
    targetUserId: string,
    currentRoles: Role[],
    newRoles: Role[],
  ): void {
    // No-op for tests
  }
}
