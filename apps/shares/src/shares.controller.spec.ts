import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';
import { SharesMetricsService } from '@bitsacco/common';
import { SharesOfferRepository, SharesRepository } from './db';

describe('SharesController', () => {
  let sharesController: SharesController;
  let sharesService: SharesService;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      controllers: [SharesController],
      providers: [
        SharesService,
        {
          provide: SharesRepository,
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
          },
        },
        {
          provide: SharesOfferRepository,
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
          },
        },
        {
          provide: SharesMetricsService,
          useValue: {
            recordSubscriptionMetric: jest.fn(),
            recordTransferMetric: jest.fn(),
            recordOwnershipMetric: jest.fn(),
          },
        },
      ],
    });

    sharesController = app.get<SharesController>(SharesController);
    sharesService = app.get<SharesService>(SharesService);
  });
});
