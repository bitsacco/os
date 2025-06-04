import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    // Mock the AuthService
    const mockAuthService = {
      loginUser: jest.fn(),
      registerUser: jest.fn(),
      verifyUser: jest.fn(),
      recoverUser: jest.fn(),
      authenticate: jest.fn(),
      refreshToken: jest.fn(),
      revokeToken: jest.fn(),
    };

    const app: TestingModule = await createTestingModuleWithValidation({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    });

    authController = app.get<AuthController>(AuthController);
    authService = app.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });
});
