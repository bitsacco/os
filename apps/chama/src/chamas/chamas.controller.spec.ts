import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ChamasController } from './chamas.controller';
import { ChamasService } from './chamas.service';

describe('ChamasController', () => {
  let chamaController: ChamasController;
  let chamaService: ChamasService;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      controllers: [ChamasController],
      providers: [ChamasService],
    });

    chamaController = app.get<ChamasController>(ChamasController);
    chamaService = app.get<ChamasService>(ChamasService);
  });
});
