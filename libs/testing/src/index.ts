import { jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { ValidationPipe } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuthServiceClient,
  JwtAuthStrategy,
  AUTH_SERVICE_NAME,
} from '@bitsacco/common';

export async function createTestingModuleWithValidation(metadata: any) {
  const app: TestingModule = await Test.createTestingModule(metadata).compile();
  await app.createNestApplication().useGlobalPipes(new ValidationPipe()).init();
  return app;
}

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
  ];
}
