import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [AuthController],
      providers: [
        ConfigService,
        {
          provide: AuthService,
          useValue: {
            loginUser: jest.fn(),
            registerUser: jest.fn(),
            verifyUser: jest.fn(),
            authenticate: jest.fn(),
          },
        },
        JwtService,
      ],
    });

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(authService).toBeDefined();
  });
});
