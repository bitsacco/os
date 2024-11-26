import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { SolowalletController } from './solowallet.controller';
import { SolowalletService } from './solowallet.service';

describe('SolowalletController', () => {
  let solowalletController: SolowalletController;
  let solowalletService: SolowalletService;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      controllers: [SolowalletController],
      providers: [SolowalletService],
    });

    solowalletController = app.get<SolowalletController>(SolowalletController);
    solowalletService = app.get<SolowalletService>(SolowalletService);
  });
});
