import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ChamaController } from './chama.controller';
import { ChamaService } from './chama.service';

describe('ChamaController', () => {
  let chamaController: ChamaController;
  let chamaService: ChamaService;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      controllers: [ChamaController],
      providers: [ChamaService],
    });

    chamaController = app.get<ChamaController>(ChamaController);
    chamaService = app.get<ChamaService>(ChamaService);
  });
});
