import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

describe('SharesController', () => {
  let sharesController: SharesController;
  let sharesService: SharesService;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      controllers: [SharesController],
      providers: [SharesService],
    });

    sharesController = app.get<SharesController>(SharesController);
    sharesService = app.get<SharesService>(SharesService);
  });
});
