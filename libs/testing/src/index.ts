import { jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { ValidationPipe } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import {
  AuthServiceClient,
  JwtAuthStrategy,
  JwtAuthGuard,
  AUTH_SERVICE_NAME,
} from '@bitsacco/common';

// Import mocks to avoid circular dependency
import { MockResourceOwnerGuard } from './mock-guards';
export * from './mock-guards';

export async function createTestingModuleWithValidation(metadata: any) {
  const app: TestingModule = await Test.createTestingModule(metadata).compile();
  await app.createNestApplication().useGlobalPipes(new ValidationPipe()).init();
  return app;
}

// Mock Reflector for ResourceOwnerGuard tests
export const provideMockReflector = () => ({
  provide: Reflector,
  useValue: {
    get: jest.fn(),
    getAllAndOverride: jest.fn(),
  },
});

// Mock JwtAuthGuard provider for tests
export const provideJwtAuthGuardMock = () => ({
  provide: JwtAuthGuard,
  useValue: {
    canActivate: jest.fn().mockReturnValue(true),
  },
});

// Mock ResourceOwnerGuard provider for tests
export const provideResourceOwnerGuardMock = () => ({
  provide: MockResourceOwnerGuard,
  useValue: {
    canActivate: jest.fn().mockReturnValue(true),
  },
});

export const provideMockGuards = () => [
  provideJwtAuthGuardMock(),
  provideResourceOwnerGuardMock(),
  provideMockReflector(),
];

export function provideJwtAuthStrategyMocks() {
  let authServiceClient: Partial<AuthServiceClient>;
  const serviceGenerator: ClientGrpc = {
    getService: jest.fn().mockReturnValue(authServiceClient),
    getClientByServiceName: jest.fn().mockReturnValue(authServiceClient),
  } as unknown as ClientGrpc;

  return [
    {
      provide: JwtAuthStrategy,
      useValue: {
        validate: jest.fn(),
      },
    },
    {
      provide: AUTH_SERVICE_NAME,
      useValue: serviceGenerator,
    },
    {
      provide: JwtService,
      useValue: {
        // Mock JwtService methods
        sign: jest.fn(),
        verify: jest.fn(),
      },
    },
    ...provideMockGuards(), // Include the mock guards for tests
  ];
}
