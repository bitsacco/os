import {
  WalletTxContext,
  SharesTxStatus,
  TransactionStatus,
  type WalletTxEvent,
  collection_for_shares,
} from '../common';
import { Test } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { SharesService } from './shares.service';
import { SharesOfferRepository, SharesRepository } from './db';
import { SharesMetricsService } from './shares.metrics';

describe('SharesService', () => {
  let service: SharesService;
  let sharesRepository: SharesRepository;
  let sharesOfferRepository: SharesOfferRepository;
  let metricsService: SharesMetricsService;
  let eventEmitter: EventEmitter2;

  // Mock data
  const mockSharesOffer = {
    _id: 'offer123',
    id: 'offer123',
    quantity: 100,
    subscribedQuantity: 20,
    availableFrom: new Date(),
    availableTo: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0,
  };

  const mockFullySubscribedOffer = {
    _id: 'fullOffer123',
    id: 'fullOffer123',
    quantity: 50,
    subscribedQuantity: 50,
    availableFrom: new Date(),
    availableTo: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0,
  };

  const mockSharesTx = {
    _id: 'sharesTx123',
    id: 'sharesTx123',
    userId: 'user123',
    offerId: 'offer123',
    quantity: 5,
    status: SharesTxStatus.PROPOSED,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
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
            getMetrics: jest.fn(),
            resetMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SharesService>(SharesService);
    sharesRepository = module.get<SharesRepository>(SharesRepository);
    sharesOfferRepository = module.get<SharesOfferRepository>(
      SharesOfferRepository,
    );
    metricsService = module.get<SharesMetricsService>(SharesMetricsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Override logger to prevent console noise during tests
    jest.spyOn(service, 'logger', 'get').mockReturnValue({
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any);

    // Mock the updateShares method
    jest.spyOn(service, 'updateShares').mockResolvedValue(null);

    // Default mock implementations
    jest.spyOn(sharesRepository, 'find').mockResolvedValue([]);
    jest.spyOn(sharesOfferRepository, 'find').mockResolvedValue([]);
    jest.spyOn(sharesRepository, 'findOne').mockResolvedValue(null);
    jest.spyOn(sharesOfferRepository, 'findOne').mockResolvedValue(null);
  });

  describe('offerShares', () => {
    beforeEach(() => {
      jest
        .spyOn(sharesOfferRepository, 'create')
        .mockResolvedValue(mockSharesOffer);
      jest.spyOn(service, 'getSharesOffers').mockResolvedValue({
        offers: [
          {
            id: mockSharesOffer.id,
            quantity: mockSharesOffer.quantity,
            subscribedQuantity: mockSharesOffer.subscribedQuantity,
            availableFrom: mockSharesOffer.availableFrom.toISOString(),
            availableTo: mockSharesOffer.availableTo.toISOString(),
            createdAt: mockSharesOffer.createdAt.toISOString(),
            updatedAt: mockSharesOffer.updatedAt.toISOString(),
          },
        ],
        totalOfferQuantity: 100,
        totalSubscribedQuantity: 20,
      });
    });

    it('should create a new shares offer with valid quantity', async () => {
      // Arrange
      const offerDto = {
        quantity: 100,
        availableFrom: new Date(),
        availableTo: new Date(Date.now() + 86400000).toISOString(),
      };

      // Act
      await service.offerShares(offerDto);

      // Assert
      expect(sharesOfferRepository.create).toHaveBeenCalledWith({
        quantity: 100,
        subscribedQuantity: 0,
        availableFrom: expect.any(Date),
        availableTo: expect.any(Date),
        __v: 0,
      });
      expect(service.getSharesOffers).toHaveBeenCalled();
    });

    it('should throw error if quantity is zero', async () => {
      // Arrange
      const offerDto = {
        quantity: 0,
        availableFrom: new Date(),
        availableTo: new Date(Date.now() + 86400000).toISOString(),
      };

      // Act & Assert
      await expect(service.offerShares(offerDto)).rejects.toThrow(
        'Share offer quantity must be greater than zero',
      );
      expect(sharesOfferRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if quantity is negative', async () => {
      // Arrange
      const offerDto = {
        quantity: -10,
        availableFrom: new Date(),
        availableTo: new Date(Date.now() + 86400000).toISOString(),
      };

      // Act & Assert
      await expect(service.offerShares(offerDto)).rejects.toThrow(
        'Share offer quantity must be greater than zero',
      );
      expect(sharesOfferRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('subscribeShares', () => {
    beforeEach(() => {
      // Reset mocks to ensure clean state for each test
      jest.spyOn(sharesRepository, 'create').mockResolvedValue(mockSharesTx);
      jest.spyOn(service, 'userSharesTransactions').mockResolvedValue({
        userId: 'user123',
        shareHoldings: 0,
        shares: { transactions: [], page: 0, size: 10, pages: 0 },
        offers: {
          offers: [],
          totalOfferQuantity: 0,
          totalSubscribedQuantity: 0,
        },
      });
      jest.spyOn(service, 'getSharesOffers').mockResolvedValue({
        offers: [
          {
            id: mockSharesOffer.id,
            quantity: mockSharesOffer.quantity,
            subscribedQuantity: mockSharesOffer.subscribedQuantity,
            availableFrom: mockSharesOffer.availableFrom.toISOString(),
            availableTo: mockSharesOffer.availableTo.toISOString(),
            createdAt: mockSharesOffer.createdAt.toISOString(),
            updatedAt: mockSharesOffer.updatedAt.toISOString(),
          },
          {
            id: mockFullySubscribedOffer.id,
            quantity: mockFullySubscribedOffer.quantity,
            subscribedQuantity: mockFullySubscribedOffer.subscribedQuantity,
            availableFrom: mockFullySubscribedOffer.availableFrom.toISOString(),
            availableTo: mockFullySubscribedOffer.availableTo.toISOString(),
            createdAt: mockFullySubscribedOffer.createdAt.toISOString(),
            updatedAt: mockFullySubscribedOffer.updatedAt.toISOString(),
          },
        ],
        totalOfferQuantity: 150, // 100 + 50
        totalSubscribedQuantity: 70, // 20 + 50
      });
    });

    it('should successfully subscribe shares when there are enough available', async () => {
      // Arrange
      const subscribeDto = {
        userId: 'user123',
        offerId: 'offer123',
        quantity: 10,
      };

      jest
        .spyOn(sharesOfferRepository, 'findOne')
        .mockResolvedValue(mockSharesOffer);

      // Act
      await service.subscribeShares(subscribeDto);

      // Assert
      expect(sharesOfferRepository.findOne).toHaveBeenCalledWith({
        _id: 'offer123',
      });
      expect(sharesRepository.create).toHaveBeenCalledWith({
        userId: 'user123',
        offerId: 'offer123',
        quantity: 10,
        status: SharesTxStatus.PROPOSED,
        __v: 0,
      });
      expect(service.userSharesTransactions).toHaveBeenCalled();
    });

    it('should throw error if requested quantity exceeds available shares', async () => {
      // Arrange
      const subscribeDto = {
        userId: 'user123',
        offerId: 'offer123',
        quantity: 90, // More than available (100-20=80)
      };

      jest
        .spyOn(sharesOfferRepository, 'findOne')
        .mockResolvedValue(mockSharesOffer);

      // Act & Assert
      await expect(service.subscribeShares(subscribeDto)).rejects.toThrow(
        'Not enough shares available for subscription. Requested: 90, Available: 80',
      );
      expect(sharesRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if offer is fully subscribed', async () => {
      // Arrange
      const subscribeDto = {
        userId: 'user123',
        offerId: 'fullOffer123',
        quantity: 1,
      };

      jest
        .spyOn(sharesOfferRepository, 'findOne')
        .mockResolvedValue(mockFullySubscribedOffer);

      // Act & Assert
      await expect(service.subscribeShares(subscribeDto)).rejects.toThrow(
        'Not enough shares available for subscription. Requested: 1, Available: 0',
      );
      expect(sharesRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if offer is not found', async () => {
      // Arrange
      const subscribeDto = {
        userId: 'user123',
        offerId: 'nonexistent',
        quantity: 10,
      };

      jest.spyOn(sharesOfferRepository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(service.subscribeShares(subscribeDto)).rejects.toThrow(
        'Share offer with ID nonexistent not found',
      );
      expect(sharesRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if subscription exceeds 20% of total shares', async () => {
      // Arrange
      const subscribeDto = {
        userId: 'user123',
        offerId: 'offer123',
        quantity: 31, // Max is 30 (20% of 150)
      };

      jest
        .spyOn(sharesOfferRepository, 'findOne')
        .mockResolvedValue(mockSharesOffer);

      // The user already has 0 shares (from the default mock)

      // Act & Assert
      await expect(service.subscribeShares(subscribeDto)).rejects.toThrow(
        /Subscription exceeds maximum allowed shares per user \(20% of total\)/,
      );
      expect(sharesRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if subscription would cause user to exceed 20% of total shares', async () => {
      // Arrange
      const subscribeDto = {
        userId: 'user123',
        offerId: 'offer123',
        quantity: 15,
      };

      // Mock that user already has 20 shares, which with 15 more would exceed 30 (20% of 150)
      jest.spyOn(service, 'userSharesTransactions').mockResolvedValue({
        userId: 'user123',
        shareHoldings: 20,
        shares: { transactions: [], page: 0, size: 10, pages: 0 },
        offers: {
          offers: [],
          totalOfferQuantity: 0,
          totalSubscribedQuantity: 0,
        },
      });

      jest
        .spyOn(sharesOfferRepository, 'findOne')
        .mockResolvedValue(mockSharesOffer);

      // Act & Assert
      await expect(service.subscribeShares(subscribeDto)).rejects.toThrow(
        /Subscription exceeds maximum allowed shares per user \(20% of total\)/,
      );
      expect(sharesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('transferShares', () => {
    const mockTransferDto = {
      sharesId: 'sharesTx123',
      fromUserId: 'user123',
      toUserId: 'user456',
      quantity: 3,
    };

    beforeEach(() => {
      jest.spyOn(sharesRepository, 'findOne').mockResolvedValue({
        ...mockSharesTx,
        status: SharesTxStatus.COMPLETE, // Shares must be COMPLETE to transfer
      });
      jest.spyOn(sharesRepository, 'create').mockResolvedValue({
        ...mockSharesTx,
        userId: 'user456',
      });
      jest.spyOn(service, 'updateShares').mockResolvedValue(null);
      jest.spyOn(service, 'getSharesOffers').mockResolvedValue({
        offers: [
          {
            id: mockSharesOffer.id,
            quantity: mockSharesOffer.quantity,
            subscribedQuantity: mockSharesOffer.subscribedQuantity,
            availableFrom: mockSharesOffer.availableFrom.toISOString(),
            availableTo: mockSharesOffer.availableTo.toISOString(),
            createdAt: mockSharesOffer.createdAt.toISOString(),
            updatedAt: mockSharesOffer.updatedAt.toISOString(),
          },
          {
            id: mockFullySubscribedOffer.id,
            quantity: mockFullySubscribedOffer.quantity,
            subscribedQuantity: mockFullySubscribedOffer.subscribedQuantity,
            availableFrom: mockFullySubscribedOffer.availableFrom.toISOString(),
            availableTo: mockFullySubscribedOffer.availableTo.toISOString(),
            createdAt: mockFullySubscribedOffer.createdAt.toISOString(),
            updatedAt: mockFullySubscribedOffer.updatedAt.toISOString(),
          },
        ],
        totalOfferQuantity: 150, // 100 + 50
        totalSubscribedQuantity: 70, // 20 + 50
      });
      jest
        .spyOn(service, 'userSharesTransactions')
        .mockImplementation((params) => {
          if (params.userId === 'user456') {
            // The recipient initially has 0 shares
            return Promise.resolve({
              userId: 'user456',
              shareHoldings: 0,
              shares: { transactions: [], page: 0, size: 10, pages: 0 },
              offers: {
                offers: [],
                totalOfferQuantity: 0,
                totalSubscribedQuantity: 0,
              },
            });
          } else {
            // The sender has 5 shares (as in mockSharesTx)
            return Promise.resolve({
              userId: 'user123',
              shareHoldings: 5,
              shares: { transactions: [], page: 0, size: 10, pages: 0 },
              offers: {
                offers: [],
                totalOfferQuantity: 0,
                totalSubscribedQuantity: 0,
              },
            });
          }
        });
    });

    it('should transfer shares when recipient is within 20% limit', async () => {
      // Act
      await service.transferShares(mockTransferDto);

      // Assert
      expect(sharesRepository.findOne).toHaveBeenCalledWith({
        _id: 'sharesTx123',
      });
      expect(service.updateShares).toHaveBeenCalledWith({
        sharesId: 'sharesTx123',
        updates: {
          quantity: 2, // 5 - 3
          transfer: {
            fromUserId: 'user123',
            toUserId: 'user456',
            quantity: 3,
          },
        },
      });
      expect(sharesRepository.create).toHaveBeenCalledWith({
        userId: 'user456',
        offerId: 'offer123',
        quantity: 3,
        status: SharesTxStatus.COMPLETE,
        transfer: {
          fromUserId: 'user123',
          toUserId: 'user456',
          quantity: 3,
        },
        __v: 0,
      });
    });

    it('should throw error if recipient would exceed 20% limit', async () => {
      // Arrange - recipient already has 25 shares
      jest
        .spyOn(service, 'userSharesTransactions')
        .mockImplementation((params) => {
          if (params.userId === 'user456') {
            return Promise.resolve({
              userId: 'user456',
              shareHoldings: 25,
              shares: { transactions: [], page: 0, size: 10, pages: 0 },
              offers: {
                offers: [],
                totalOfferQuantity: 0,
                totalSubscribedQuantity: 0,
              },
            });
          } else {
            return Promise.resolve({
              userId: 'user123',
              shareHoldings: 5,
              shares: { transactions: [], page: 0, size: 10, pages: 0 },
              offers: {
                offers: [],
                totalOfferQuantity: 0,
                totalSubscribedQuantity: 0,
              },
            });
          }
        });

      // Try to transfer 3 shares, which would push recipient to 28 (still under 20% of 150)
      // But would pass the initial quantity check, allowing us to test the 20% limit

      // Mock that the user has 20 shares (instead of 5)
      jest.spyOn(sharesRepository, 'findOne').mockResolvedValue({
        ...mockSharesTx,
        quantity: 20,
        status: SharesTxStatus.COMPLETE,
      });

      // Try to transfer 6 shares, which would push recipient to 31 (over 20% of 150)
      const largeTransferDto = {
        ...mockTransferDto,
        quantity: 6,
      };

      // Act & Assert
      await expect(service.transferShares(largeTransferDto)).rejects.toThrow(
        /Transfer exceeds maximum allowed shares per user \(20% of total\)/,
      );
      expect(service.updateShares).not.toHaveBeenCalled();
      expect(sharesRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if shares are not available to transfer', async () => {
      // Arrange - Shares are not COMPLETE
      jest.spyOn(sharesRepository, 'findOne').mockResolvedValue({
        ...mockSharesTx,
        status: SharesTxStatus.PENDING,
      });

      // Act & Assert
      await expect(service.transferShares(mockTransferDto)).rejects.toThrow(
        'Shares are not available to transfer',
      );
      expect(service.updateShares).not.toHaveBeenCalled();
      expect(sharesRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if not enough shares to transfer', async () => {
      // Arrange - Try to transfer more shares than available
      const largeTransferDto = {
        ...mockTransferDto,
        quantity: 10, // More than the 5 available
      };

      // Act & Assert
      await expect(service.transferShares(largeTransferDto)).rejects.toThrow(
        'Not enough shares to transfer',
      );
      expect(service.updateShares).not.toHaveBeenCalled();
      expect(sharesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('handleWalletTxForShares', () => {
    it('should update shares transaction to COMPLETE when payment is completed', async () => {
      // Arrange
      const walletTxEvent: WalletTxEvent = {
        context: WalletTxContext.COLLECTION_FOR_SHARES,
        payload: {
          paymentTracker: 'sharesTx123',
          paymentStatus: TransactionStatus.COMPLETE,
        },
      };

      jest.spyOn(sharesRepository, 'findOne').mockResolvedValue(mockSharesTx);
      jest
        .spyOn(sharesOfferRepository, 'findOne')
        .mockResolvedValue(mockSharesOffer);

      // Act
      await eventEmitter.emit(collection_for_shares, walletTxEvent);
      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(sharesRepository.findOne).toHaveBeenCalledWith({
        _id: 'sharesTx123',
      });
      expect(service.updateShares).toHaveBeenCalledWith({
        sharesId: 'sharesTx123',
        updates: {
          status: SharesTxStatus.COMPLETE,
        },
      });
      expect(sharesOfferRepository.findOne).toHaveBeenCalledWith({
        _id: 'offer123',
      });
      expect(sharesOfferRepository.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'offer123' },
        {
          subscribedQuantity:
            mockSharesOffer.subscribedQuantity + mockSharesTx.quantity,
        },
      );
    });

    it('should update shares transaction to PROCESSING when payment is processing', async () => {
      // Arrange
      const walletTxEvent: WalletTxEvent = {
        context: WalletTxContext.COLLECTION_FOR_SHARES,
        payload: {
          paymentTracker: 'sharesTx123',
          paymentStatus: TransactionStatus.PROCESSING,
        },
      };

      jest.spyOn(sharesRepository, 'findOne').mockResolvedValue(mockSharesTx);

      // Act
      await eventEmitter.emit(collection_for_shares, walletTxEvent);
      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(sharesRepository.findOne).toHaveBeenCalledWith({
        _id: 'sharesTx123',
      });
      expect(service.updateShares).toHaveBeenCalledWith({
        sharesId: 'sharesTx123',
        updates: {
          status: SharesTxStatus.PROCESSING,
        },
      });
      // Should not try to update the subscribed quantity for PROCESSING status
      expect(sharesOfferRepository.findOne).not.toHaveBeenCalled();
      expect(sharesOfferRepository.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should update shares transaction to FAILED when payment fails', async () => {
      // Arrange
      const walletTxEvent: WalletTxEvent = {
        context: WalletTxContext.COLLECTION_FOR_SHARES,
        payload: {
          paymentTracker: 'sharesTx123',
          paymentStatus: TransactionStatus.FAILED,
        },
      };

      jest.spyOn(sharesRepository, 'findOne').mockResolvedValue(mockSharesTx);

      // Act
      await eventEmitter.emit(collection_for_shares, walletTxEvent);
      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(sharesRepository.findOne).toHaveBeenCalledWith({
        _id: 'sharesTx123',
      });
      expect(service.updateShares).toHaveBeenCalledWith({
        sharesId: 'sharesTx123',
        updates: {
          status: SharesTxStatus.FAILED,
        },
      });
      // Should not try to update the subscribed quantity for FAILED status
      expect(sharesOfferRepository.findOne).not.toHaveBeenCalled();
      expect(sharesOfferRepository.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should handle wallet tx error properly', async () => {
      // Arrange
      const walletTxEvent: WalletTxEvent = {
        context: WalletTxContext.COLLECTION_FOR_SHARES,
        payload: {
          paymentTracker: 'sharesTx123',
          paymentStatus: TransactionStatus.FAILED,
        },
        error: 'Payment processing error',
      };

      jest.spyOn(sharesRepository, 'findOne').mockResolvedValue(mockSharesTx);

      // Act
      await eventEmitter.emit(collection_for_shares, walletTxEvent);
      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(sharesRepository.findOne).toHaveBeenCalledWith({
        _id: 'sharesTx123',
      });
      expect(service.updateShares).toHaveBeenCalledWith({
        sharesId: 'sharesTx123',
        updates: {
          status: SharesTxStatus.FAILED,
        },
      });
      // Should not try to update the subscribed quantity for FAILED status with error
      expect(sharesOfferRepository.findOne).not.toHaveBeenCalled();
      expect(sharesOfferRepository.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should do nothing if shares transaction is not found', async () => {
      // Arrange
      const walletTxEvent: WalletTxEvent = {
        context: WalletTxContext.COLLECTION_FOR_SHARES,
        payload: {
          paymentTracker: 'nonexistent',
          paymentStatus: TransactionStatus.COMPLETE,
        },
      };

      jest.spyOn(sharesRepository, 'findOne').mockResolvedValue(null);

      // Act
      await eventEmitter.emit(collection_for_shares, walletTxEvent);
      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(sharesRepository.findOne).toHaveBeenCalledWith({
        _id: 'nonexistent',
      });
      expect(service.updateShares).not.toHaveBeenCalled();
      expect(sharesOfferRepository.findOne).not.toHaveBeenCalled();
      expect(sharesOfferRepository.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('updateShareOffer', () => {
    it('should successfully update offer quantity', async () => {
      // Arrange
      const updatedOffer = {
        ...mockSharesOffer,
        quantity: 150,
      };

      jest
        .spyOn(sharesOfferRepository, 'findOne')
        .mockResolvedValue(mockSharesOffer);
      jest
        .spyOn(sharesOfferRepository, 'findOneAndUpdate')
        .mockResolvedValue(updatedOffer);
      jest.spyOn(service, 'getSharesOffers').mockResolvedValue({
        offers: [updatedOffer],
        totalOfferQuantity: 150,
        totalSubscribedQuantity: 20,
      });

      // Act
      const result = await service.updateShareOffer({
        offerId: 'offer123',
        updates: { quantity: 150 },
      });

      // Assert
      expect(sharesOfferRepository.findOne).toHaveBeenCalledWith({
        _id: 'offer123',
      });
      expect(sharesOfferRepository.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'offer123' },
        { quantity: 150 },
      );
      expect(result.totalOfferQuantity).toBe(150);
    });

    it('should successfully update subscribedQuantity', async () => {
      // Arrange
      const updatedOffer = {
        ...mockSharesOffer,
        subscribedQuantity: 30,
      };

      jest
        .spyOn(sharesOfferRepository, 'findOne')
        .mockResolvedValue(mockSharesOffer);
      jest
        .spyOn(sharesOfferRepository, 'findOneAndUpdate')
        .mockResolvedValue(updatedOffer);
      jest.spyOn(service, 'getSharesOffers').mockResolvedValue({
        offers: [updatedOffer],
        totalOfferQuantity: 100,
        totalSubscribedQuantity: 30,
      });

      // Act
      const result = await service.updateShareOffer({
        offerId: 'offer123',
        updates: { subscribedQuantity: 30 },
      });

      // Assert
      expect(sharesOfferRepository.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'offer123' },
        { subscribedQuantity: 30 },
      );
      expect(result.totalSubscribedQuantity).toBe(30);
    });

    it('should successfully update availability dates', async () => {
      // Arrange
      const newFromDate = '2024-01-01T00:00:00.000Z';
      const newToDate = '2024-12-31T00:00:00.000Z';

      jest
        .spyOn(sharesOfferRepository, 'findOne')
        .mockResolvedValue(mockSharesOffer);
      jest
        .spyOn(sharesOfferRepository, 'findOneAndUpdate')
        .mockResolvedValue(mockSharesOffer);
      jest.spyOn(service, 'getSharesOffers').mockResolvedValue({
        offers: [mockSharesOffer],
        totalOfferQuantity: 100,
        totalSubscribedQuantity: 20,
      });

      // Act
      await service.updateShareOffer({
        offerId: 'offer123',
        updates: {
          availableFrom: newFromDate,
          availableTo: newToDate,
        },
      });

      // Assert
      expect(sharesOfferRepository.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'offer123' },
        {
          availableFrom: new Date(newFromDate),
          availableTo: new Date(newToDate),
        },
      );
    });

    it('should throw error if offer is not found', async () => {
      // Arrange
      jest.spyOn(sharesOfferRepository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateShareOffer({
          offerId: 'nonexistent',
          updates: { quantity: 150 },
        }),
      ).rejects.toThrow('Share offer with ID nonexistent not found');
    });

    it('should throw error if reducing quantity below subscribed amount', async () => {
      // Arrange
      jest
        .spyOn(sharesOfferRepository, 'findOne')
        .mockResolvedValue(mockSharesOffer);

      // Act & Assert
      await expect(
        service.updateShareOffer({
          offerId: 'offer123',
          updates: { quantity: 10 }, // Less than subscribed quantity (20)
        }),
      ).rejects.toThrow('Cannot reduce offer quantity below subscribed amount');
    });

    it('should throw error if subscribed quantity exceeds total quantity', async () => {
      // Arrange
      jest
        .spyOn(sharesOfferRepository, 'findOne')
        .mockResolvedValue(mockSharesOffer);

      // Act & Assert
      await expect(
        service.updateShareOffer({
          offerId: 'offer123',
          updates: { subscribedQuantity: 150 }, // More than total quantity (100)
        }),
      ).rejects.toThrow(
        'Subscribed quantity cannot exceed total offer quantity',
      );
    });
  });
});
