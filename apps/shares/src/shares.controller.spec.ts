import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';
import { SharesMetricsService } from '@bitsacco/common';

describe('SharesController', () => {
  let sharesController: SharesController;
  let sharesService: SharesService;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      controllers: [SharesController],
      providers: [
        SharesService,
        {
          provide: SharesMetricsService,
          useValue: {
            recordSubscriptionMetric: jest.fn(),
            recordTransferMetric: jest.fn(),
            recordOwnershipMetric: jest.fn(),
            getMetrics: jest.fn(),
            resetMetrics: jest.fn(),
          },
        },
      ],
    });

    sharesController = app.get<SharesController>(SharesController);
    sharesService = app.get<SharesService>(SharesService);
  });
});
