import { SetMetadata } from '@nestjs/common';

// Mock definitions for testing
export class MockResourceOwnerGuard {
  canActivate() {
    return true;
  }
}

export interface MockOwnershipConfig {
  paramName: string;
  idField?: string;
}

export const MockCheckOwnership = (config: MockOwnershipConfig) =>
  SetMetadata('mock_ownership_check', config);
