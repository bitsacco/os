import { Test } from '@nestjs/testing';
import { SharesService } from './shares.service';
import { SharesOfferRepository, SharesRepository } from './db';
import {
  WalletTxContext,
  WalletTxEvent,
  SharesTxStatus,
  TransactionStatus,
} from '@bitsacco/common';

describe('SharesService', () => {
  let service: SharesService;
  let sharesRepository: SharesRepository;
  let sharesOfferRepository: SharesOfferRepository;

  // Mock data
  const mockSharesOffer = {
    _id: 'offer123',
    quantity: 100,
    subscribedQuantity: 20,
    availableFrom: new Date(),
    availableTo: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSharesTx = {
    _id: 'sharesTx123',
    userId: 'user123',
    offerId: 'offer123',
    quantity: 5,
    status: SharesTxStatus.PROPOSED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
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
      ],
    }).compile();

    service = module.get<SharesService>(SharesService);
    sharesRepository = module.get<SharesRepository>(SharesRepository);
    sharesOfferRepository = module.get<SharesOfferRepository>(
      SharesOfferRepository,
    );

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
      await service.handleWalletTxForShares(walletTxEvent);

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
      await service.handleWalletTxForShares(walletTxEvent);

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
      await service.handleWalletTxForShares(walletTxEvent);

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
      await service.handleWalletTxForShares(walletTxEvent);

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
      await service.handleWalletTxForShares(walletTxEvent);

      // Assert
      expect(sharesRepository.findOne).toHaveBeenCalledWith({
        _id: 'nonexistent',
      });
      expect(service.updateShares).not.toHaveBeenCalled();
    });
  });
});
