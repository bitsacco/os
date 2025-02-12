import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ChamaController } from './chama.controller';
import { ChamasService } from './chamas/chamas.service';

describe('ChamaController', () => {
  let chamaController: ChamaController;
  let chamaService: ChamasService;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      controllers: [ChamaController],
      providers: [ChamasService],
    });

    chamaController = app.get<ChamaController>(ChamaController);
    chamaService = app.get<ChamasService>(ChamasService);
  });
});
