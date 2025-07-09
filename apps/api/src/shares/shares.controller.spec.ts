import { TestingModule } from '@nestjs/testing';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';
import { SharesMetricsService } from './shares.metrics';
import { SharesOfferRepository, SharesRepository } from './db';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('SharesController', () => {
  let sharesController: SharesController;
  let sharesService: SharesService;

  beforeEach(async () => {
    const jwtAuthMocks = provideJwtAuthStrategyMocks();

    // Create mocks for the services
    const mockSharesService = {
      offerShares: jest.fn().mockResolvedValue({
        offers: [],
        totalOfferQuantity: 0,
        totalSubscribedQuantity: 0,
      }),
      getSharesOffers: jest.fn().mockResolvedValue({
        offers: [],
        totalOfferQuantity: 0,
        totalSubscribedQuantity: 0,
      }),
      subscribeShares: jest.fn().mockResolvedValue({
        userId: 'test-user',
        shareHoldings: 0,
        shares: { transactions: [], page: 0, size: 0, pages: 0 },
        offers: {
          offers: [],
          totalOfferQuantity: 0,
          totalSubscribedQuantity: 0,
        },
      }),
      transferShares: jest.fn().mockResolvedValue({
        userId: 'test-user',
        shareHoldings: 0,
        shares: { transactions: [], page: 0, size: 0, pages: 0 },
        offers: {
          offers: [],
          totalOfferQuantity: 0,
          totalSubscribedQuantity: 0,
        },
      }),
      updateShares: jest.fn().mockResolvedValue({
        userId: 'test-user',
        shareHoldings: 0,
        shares: { transactions: [], page: 0, size: 0, pages: 0 },
        offers: {
          offers: [],
          totalOfferQuantity: 0,
          totalSubscribedQuantity: 0,
        },
      }),
      allSharesTransactions: jest.fn().mockResolvedValue({
        shares: { transactions: [], page: 0, size: 0, pages: 0 },
        offers: {
          offers: [],
          totalOfferQuantity: 0,
          totalSubscribedQuantity: 0,
        },
      }),
      userSharesTransactions: jest.fn().mockResolvedValue({
        userId: 'test-user',
        shareHoldings: 0,
        shares: { transactions: [], page: 0, size: 0, pages: 0 },
        offers: {
          offers: [],
          totalOfferQuantity: 0,
          totalSubscribedQuantity: 0,
        },
      }),
      findSharesTransaction: jest.fn().mockResolvedValue({
        id: 'test-id',
        userId: 'test-user',
        offerId: 'test-offer',
        quantity: 100,
        status: 1,
        createdAt: new Date().toDateString(),
        updatedAt: new Date().toDateString(),
      }),
    };

    const mockSharesMetricsService = {
      recordSubscriptionMetric: jest.fn(),
      recordTransferMetric: jest.fn(),
      recordOwnershipMetric: jest.fn(),
    };

    const mockSharesOfferRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const mockSharesRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SharesController],
      providers: [
        {
          provide: SharesService,
          useValue: mockSharesService,
        },
        {
          provide: SharesMetricsService,
          useValue: mockSharesMetricsService,
        },
        {
          provide: SharesOfferRepository,
          useValue: mockSharesOfferRepository,
        },
        {
          provide: SharesRepository,
          useValue: mockSharesRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        ...jwtAuthMocks,
      ],
    });

    sharesController = module.get<SharesController>(SharesController);
    sharesService = module.get<SharesService>(SharesService);
  });

  it('should be defined', () => {
    expect(sharesController).toBeDefined();
  });
});
