import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let authController: AuthController;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      controllers: [AuthController],
      providers: [AuthService],
    });

    authController = app.get<AuthController>(AuthController);
  });
});
