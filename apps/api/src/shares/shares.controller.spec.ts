import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';

import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

describe.skip('SharesController', () => {
  let controller: SharesController;
  let sharesService: SharesService;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SharesController],
      providers: [
        {
          provide: SharesService,
          useValue: {
            buyShares: jest.fn(),
          },
        },
      ],
    });

    controller = module.get<SharesController>(SharesController);
    sharesService = module.get<SharesService>(SharesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(sharesService).toBeDefined();
  });
});
