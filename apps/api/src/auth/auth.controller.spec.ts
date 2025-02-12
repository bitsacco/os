import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';

import { AuthController } from './auth.controller';
import { type ClientGrpc } from '@nestjs/microservices';
import { AUTH_SERVICE_NAME, AuthServiceClient } from '@bitsacco/common';

describe('AuthController', () => {
  let serviceGenerator: ClientGrpc;
  let authController: AuthController;
  let authServiceClient: Partial<AuthServiceClient>;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(authServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(authServiceClient),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [AuthController],
      providers: [
        ConfigService,
        {
          provide: AUTH_SERVICE_NAME,
          useValue: serviceGenerator,
        },
        JwtService,
      ],
    });

    authController = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });
});
