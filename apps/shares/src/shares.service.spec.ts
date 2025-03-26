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
  
  const mockFullySubscribedOffer = {
    _id: 'fullOffer123',
    quantity: 50,
    subscribedQuantity: 50,
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

  describe('offerShares', () => {
    beforeEach(() => {
      jest.spyOn(sharesOfferRepository, 'create').mockResolvedValue(mockSharesOffer);
      jest.spyOn(service, 'getSharesOffers').mockResolvedValue({
        offers: [mockSharesOffer],
        totalOfferQuantity: 100,
        totalSubscribedQuantity: 20,
      });
    });
    
    it('should create a new shares offer with valid quantity', async () => {
      // Arrange
      const offerDto = {
        quantity: 100,
        availableFrom: new Date().toISOString(),
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
      });
      expect(service.getSharesOffers).toHaveBeenCalled();
    });
    
    it('should throw error if quantity is zero', async () => {
      // Arrange
      const offerDto = {
        quantity: 0,
        availableFrom: new Date().toISOString(),
        availableTo: new Date(Date.now() + 86400000).toISOString(),
      };
      
      // Act & Assert
      await expect(service.offerShares(offerDto)).rejects.toThrow(
        'Share offer quantity must be greater than zero'
      );
      expect(sharesOfferRepository.create).not.toHaveBeenCalled();
    });
    
    it('should throw error if quantity is negative', async () => {
      // Arrange
      const offerDto = {
        quantity: -10,
        availableFrom: new Date().toISOString(),
        availableTo: new Date(Date.now() + 86400000).toISOString(),
      };
      
      // Act & Assert
      await expect(service.offerShares(offerDto)).rejects.toThrow(
        'Share offer quantity must be greater than zero'
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
        offers: { offers: [], totalOfferQuantity: 0, totalSubscribedQuantity: 0 },
      });
    });

    it('should successfully subscribe shares when there are enough available', async () => {
      // Arrange
      const subscribeDto = {
        userId: 'user123',
        offerId: 'offer123',
        quantity: 10,
      };
      
      jest.spyOn(sharesOfferRepository, 'findOne').mockResolvedValue(mockSharesOffer);
      
      // Act
      await service.subscribeShares(subscribeDto);
      
      // Assert
      expect(sharesOfferRepository.findOne).toHaveBeenCalledWith({ _id: 'offer123' });
      expect(sharesRepository.create).toHaveBeenCalledWith({
        userId: 'user123',
        offerId: 'offer123',
        quantity: 10,
        status: SharesTxStatus.PROPOSED,
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
      
      jest.spyOn(sharesOfferRepository, 'findOne').mockResolvedValue(mockSharesOffer);
      
      // Act & Assert
      await expect(service.subscribeShares(subscribeDto)).rejects.toThrow(
        'Not enough shares available for subscription. Requested: 90, Available: 80'
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
      
      jest.spyOn(sharesOfferRepository, 'findOne').mockResolvedValue(mockFullySubscribedOffer);
      
      // Act & Assert
      await expect(service.subscribeShares(subscribeDto)).rejects.toThrow(
        'Not enough shares available for subscription. Requested: 1, Available: 0'
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
        'Share offer with ID nonexistent not found'
      );
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
      expect(sharesOfferRepository.findOne).toHaveBeenCalledWith({
        _id: 'offer123',
      });
      expect(sharesOfferRepository.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'offer123' },
        {
          subscribedQuantity: mockSharesOffer.subscribedQuantity + mockSharesTx.quantity,
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
      await service.handleWalletTxForShares(walletTxEvent);

      // Assert
      expect(sharesRepository.findOne).toHaveBeenCalledWith({
        _id: 'nonexistent',
      });
      expect(service.updateShares).not.toHaveBeenCalled();
      expect(sharesOfferRepository.findOne).not.toHaveBeenCalled();
      expect(sharesOfferRepository.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
