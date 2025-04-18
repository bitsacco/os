import { Test, TestingModule } from '@nestjs/testing';
import { ChamaWalletService } from './wallet.service';
import { ChamaWalletRepository } from './db';
import {
  collection_for_shares,
  EVENTS_SERVICE_BUS,
  FedimintContext,
  type FedimintReceiveSuccessEvent,
  FedimintService,
  LnurlMetricsService,
  SWAP_SERVICE_NAME,
  TransactionStatus,
  WalletTxContext,
} from '@bitsacco/common';
import { ChamaMetricsService } from '../chamas/chama.metrics';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChamasService } from '../chamas/chamas.service';
import { UsersService } from '@bitsacco/common';
import { ChamaMessageService } from '../chamas/chamas.messaging';

describe('ChamaWalletService', () => {
  let service: ChamaWalletService;
  let eventEmitter: EventEmitter2;
  let eventsClient: any;

  const mockWalletRepository = {
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
  };

  const mockFedimintService = {
    invoice: jest.fn(),
    receive: jest.fn(),
  };

  const mockMetricsService = {
    recordWithdrawalMetric: jest.fn(),
    getMetrics: jest.fn(),
    resetMetrics: jest.fn(),
  };

  const mockSwapGrpc = {
    getService: jest.fn().mockReturnValue({}),
  };

  const mockEventsClient = {
    emit: jest.fn().mockReturnValue({
      subscribe: jest.fn(),
    }),
  };

  const mockChamasService = {};
  const mockUsersService = {};
  const mockMessengerService = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChamaWalletService,
        {
          provide: ChamaWalletRepository,
          useValue: mockWalletRepository,
        },
        {
          provide: FedimintService,
          useValue: mockFedimintService,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
          },
        },
        {
          provide: SWAP_SERVICE_NAME,
          useValue: mockSwapGrpc,
        },
        {
          provide: EVENTS_SERVICE_BUS,
          useValue: mockEventsClient,
        },
        {
          provide: ChamasService,
          useValue: mockChamasService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ChamaMessageService,
          useValue: mockMessengerService,
        },
        {
          provide: LnurlMetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: ChamaMetricsService,
          useValue: {
            recordDepositMetric: jest.fn(),
            recordWithdrawalMetric: jest.fn(),
            recordChamaBalanceMetric: jest.fn(),
            recordMemberBalanceMetric: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChamaWalletService>(ChamaWalletService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    eventsClient = module.get(EVENTS_SERVICE_BUS);
  });

  describe('handleSuccessfulReceive', () => {
    it('should update transaction to COMPLETE when payment is successful', async () => {
      // Arrange
      const operationId = 'test-operation-id';
      const mockTx = {
        _id: 'tx123',
        status: TransactionStatus.PENDING,
      };

      mockWalletRepository.findOneAndUpdate.mockResolvedValue(mockTx);

      const event: FedimintReceiveSuccessEvent = {
        context: FedimintContext.CHAMAWALLET_RECEIVE,
        operationId,
      };

      // Act
      await service.handleSuccessfulReceive(event);

      // Assert
      expect(mockWalletRepository.findOneAndUpdate).toHaveBeenCalledWith(
        { paymentTracker: operationId },
        { status: TransactionStatus.COMPLETE },
      );
    });

    it('should emit collection_for_shares event via Redis when transaction has sharesSubscriptionTracker context', async () => {
      // Arrange
      const operationId = 'test-operation-id';
      const sharesId = 'shares-subscription-id';
      const mockTx = {
        _id: 'tx123',
        status: TransactionStatus.PENDING,
        context: JSON.stringify({
          sharesSubscriptionTracker: sharesId,
        }),
      };

      mockWalletRepository.findOneAndUpdate.mockResolvedValue(mockTx);

      const event: FedimintReceiveSuccessEvent = {
        context: FedimintContext.CHAMAWALLET_RECEIVE,
        operationId,
      };

      const eventsEmitSpy = jest.spyOn(eventsClient, 'emit');

      // Act
      await service.handleSuccessfulReceive(event);

      // Assert
      expect(mockWalletRepository.findOneAndUpdate).toHaveBeenCalledWith(
        { paymentTracker: operationId },
        { status: TransactionStatus.COMPLETE },
      );

      expect(eventsEmitSpy).toHaveBeenCalledWith(collection_for_shares, {
        context: WalletTxContext.COLLECTION_FOR_SHARES,
        payload: {
          paymentTracker: sharesId,
          paymentStatus: TransactionStatus.COMPLETE,
        },
      });
    });

    it('should handle missing or invalid context gracefully', async () => {
      // Arrange
      const operationId = 'test-operation-id';
      const mockTx = {
        _id: 'tx123',
        status: TransactionStatus.PENDING,
        context: 'invalid-json', // This will cause JSON.parse to fail
      };

      mockWalletRepository.findOneAndUpdate.mockResolvedValue(mockTx);

      const event: FedimintReceiveSuccessEvent = {
        context: FedimintContext.CHAMAWALLET_RECEIVE,
        operationId,
      };

      const eventsEmitSpy = jest.spyOn(eventsClient, 'emit');

      // Act - this should not throw an error
      await service.handleSuccessfulReceive(event);

      // Assert
      expect(mockWalletRepository.findOneAndUpdate).toHaveBeenCalledWith(
        { paymentTracker: operationId },
        { status: TransactionStatus.COMPLETE },
      );

      // Event should not be emitted due to invalid context
      expect(eventsEmitSpy).not.toHaveBeenCalled();
    });
  });
});
