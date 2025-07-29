import { Test, TestingModule } from '@nestjs/testing';
import { SwapService } from '../swap/swap.service';
import {
  collection_for_shares,
  FedimintContext,
  type FedimintReceiveSuccessEvent,
  FedimintService,
  LnurlMetricsService,
  SWAP_SERVICE_NAME,
  TransactionStatus,
  UsersService,
  WalletTxContext,
} from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChamasService } from '../chamas/chamas.service';
import { ChamaMetricsService } from '../chamas/chama.metrics';
import { ChamaMessageService } from '../chamas/chamas.messaging';
import { ChamaWalletService } from './wallet.service';
import { ChamaWalletRepository } from './db';
import { ConfigService } from '@nestjs/config';

describe('ChamaWalletService', () => {
  let service: ChamaWalletService;
  let eventEmitter: EventEmitter2;

  const mockWalletRepository = {
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  };

  const mockFedimintService = {
    initialize: jest.fn(),
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

  const mockChamasService = {
    findChama: jest.fn().mockImplementation(({ chamaId }) => {
      return Promise.resolve({
        id: chamaId,
        name: `Chama ${chamaId}`,
        members: [
          { userId: 'user1', roles: [] },
          { userId: 'user2', roles: [] },
        ],
      });
    }),
    filterChamas: jest.fn(),
  };
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
        {
          provide: SwapService,
          useValue: {
            getQuote: jest.fn(),
            createOnrampSwap: jest.fn(),
            createOfframpSwap: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'CHAMA_CLIENTD_BASE_URL':
                  return 'http://localhost:2121';
                case 'CHAMA_CLIENTD_PASSWORD':
                  return 'password';
                case 'CHAMA_FEDERATION_ID':
                  return 'federation123';
                case 'CHAMA_GATEWAY_ID':
                  return 'gateway123';
                case 'CHAMA_LNURL_CALLBACK':
                  return 'https://bitsacco.com/lnurl/callback';
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ChamaWalletService>(ChamaWalletService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
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

      const eventsEmitSpy = jest.spyOn(eventEmitter, 'emit');

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

      const eventsEmitSpy = jest.spyOn(eventEmitter, 'emit');

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

  // describe('aggregateBulkWalletMeta', () => {
  //   beforeEach(() => {
  //     // Setup mockWalletRepository.aggregate to return test data
  //     mockWalletRepository.aggregate.mockImplementation((pipeline) => {
  //       // Extract the chamaId from the pipeline if it exists
  //       const chamaIdFilter = pipeline?.[0]?.$match?.chamaId;
  //       const typeFilter = pipeline?.[0]?.$match?.type;

  //       if (typeFilter && typeFilter.toString() === 'DEPOSIT') {
  //         return Promise.resolve([{ totalMsats: 100000 }]);
  //       } else if (typeFilter && typeFilter.toString() === 'WITHDRAW') {
  //         return Promise.resolve([{ totalMsats: 50000 }]);
  //       }

  //       return Promise.resolve([]);
  //     });

  //     // Mock the aggregateWalletMeta method to ensure consistent test data
  //     jest
  //       .spyOn(service, 'aggregateWalletMeta')
  //       .mockImplementation(({ chamaId, selectMemberIds, skipMemberMeta }) => {
  //         const members = selectMemberIds?.length
  //           ? selectMemberIds.map((id) => ({
  //               memberId: id,
  //               memberMeta: {
  //                 memberDeposits: 100000,
  //                 memberWithdrawals: 50000,
  //                 memberBalance: 50000,
  //               },
  //             }))
  //           : skipMemberMeta
  //             ? []
  //             : [
  //                 {
  //                   memberId: 'user1',
  //                   memberMeta: {
  //                     memberDeposits: 100000,
  //                     memberWithdrawals: 50000,
  //                     memberBalance: 50000,
  //                   },
  //                 },
  //                 {
  //                   memberId: 'user2',
  //                   memberMeta: {
  //                     memberDeposits: 100000,
  //                     memberWithdrawals: 50000,
  //                     memberBalance: 50000,
  //                   },
  //                 },
  //               ];

  //         return Promise.resolve({
  //           chamaId,
  //           groupMeta: {
  //             groupDeposits: 100000,
  //             groupWithdrawals: 50000,
  //             groupBalance: 50000,
  //           },
  //           memberMeta: members,
  //         });
  //       });
  //   });

  //   it('should aggregate wallet meta for multiple chamas', async () => {
  //     // Arrange
  //     const chamaIds = ['chama1', 'chama2', 'chama3'];

  //     // Setup the spy for the aggregateWalletMeta method
  //     const spy = jest.spyOn(service, 'aggregateWalletMeta');

  //     // Act
  //     const result = await service.aggregateBulkWalletMeta({
  //       chamaIds,
  //     });

  //     // Assert
  //     expect(result).toBeDefined();
  //     expect(result.meta).toHaveLength(3);

  //     // Check the spy was called for each chamaId
  //     expect(spy).toHaveBeenCalledTimes(3);
  //     chamaIds.forEach((chamaId) => {
  //       expect(spy).toHaveBeenCalledWith({
  //         chamaId,
  //         selectMemberIds: undefined,
  //         skipMemberMeta: undefined,
  //       });
  //     });

  //     // Verify that aggregateWalletMeta was called for each chama ID
  //     chamaIds.forEach((chamaId) => {
  //       expect(spy).toHaveBeenCalledWith(
  //         expect.objectContaining({
  //           chamaId,
  //         }),
  //       );
  //     });

  //     // Verify that we got a result structure back
  //     expect(result.meta).toBeDefined();
  //   });

  //   it('should filter members when selectMemberIds is provided', async () => {
  //     // Arrange
  //     const chamaIds = ['chama1', 'chama2'];
  //     const selectMemberIds = ['user1']; // Only include user1

  //     // Setup the spy for the aggregateWalletMeta method
  //     const spy = jest.spyOn(service, 'aggregateWalletMeta');

  //     // Act
  //     const result = await service.aggregateBulkWalletMeta({
  //       chamaIds,
  //       selectMemberIds,
  //     });

  //     // Assert
  //     expect(result).toBeDefined();
  //     expect(result.meta).toHaveLength(2);

  //     // Check that the spy was called with correct parameters
  //     expect(spy).toHaveBeenCalledTimes(2);
  //     chamaIds.forEach((chamaId) => {
  //       expect(spy).toHaveBeenCalledWith({
  //         chamaId,
  //         selectMemberIds,
  //         skipMemberMeta: undefined,
  //       });
  //     });

  //     // Verify the expected structure
  //     expect(result.meta).toBeDefined();

  //     // If the mock works as expected, we should have the same structure
  //     // as in the first test - this is more of a sanity check
  //     if (result.meta[0] && result.meta[0].memberMeta) {
  //       expect(result.meta[0].memberMeta).toHaveLength(1);
  //       expect(result.meta[0].memberMeta[0].memberId).toBe('user1');
  //     }
  //   });

  //   it('should skip member meta when skipMemberMeta is true', async () => {
  //     // Arrange
  //     const chamaIds = ['chama1', 'chama2'];

  //     // Setup the spy for the aggregateWalletMeta method
  //     const spy = jest.spyOn(service, 'aggregateWalletMeta');

  //     // Act
  //     const result = await service.aggregateBulkWalletMeta({
  //       chamaIds,
  //       skipMemberMeta: true,
  //     });

  //     // Assert
  //     expect(result).toBeDefined();
  //     expect(result.meta).toHaveLength(2);

  //     // Check that the spy was called with correct parameters
  //     expect(spy).toHaveBeenCalledTimes(2);
  //     chamaIds.forEach((chamaId) => {
  //       expect(spy).toHaveBeenCalledWith({
  //         chamaId,
  //         selectMemberIds: undefined,
  //         skipMemberMeta: true,
  //       });
  //     });

  //     // Verify the expected structure
  //     expect(result.meta).toBeDefined();

  //     // If the mock works as expected, we should have the same structure
  //     // as in the first test - this is more of a sanity check
  //     if (result.meta[0] && result.meta[0].memberMeta) {
  //       expect(result.meta[0].memberMeta).toHaveLength(0);
  //     }
  //   });

  //   it('should handle errors for individual chamas gracefully', async () => {
  //     // Arrange
  //     const chamaIds = ['chama1', 'error-chama', 'chama3'];

  //     // Override the mock implementation just for this test
  //     const spy = jest
  //       .spyOn(service, 'aggregateWalletMeta')
  //       .mockImplementation(({ chamaId, selectMemberIds, skipMemberMeta }) => {
  //         // For the error case, throw an error to test error handling
  //         if (chamaId === 'error-chama') {
  //           return Promise.reject(new Error('Simulated error for chama'));
  //         }

  //         // For other cases, use the standard mock
  //         const members = selectMemberIds?.length
  //           ? selectMemberIds.map((id) => ({
  //               memberId: id,
  //               memberMeta: {
  //                 memberDeposits: 100000,
  //                 memberWithdrawals: 50000,
  //                 memberBalance: 50000,
  //               },
  //             }))
  //           : skipMemberMeta
  //             ? []
  //             : [
  //                 {
  //                   memberId: 'user1',
  //                   memberMeta: {
  //                     memberDeposits: 100000,
  //                     memberWithdrawals: 50000,
  //                     memberBalance: 50000,
  //                   },
  //                 },
  //                 {
  //                   memberId: 'user2',
  //                   memberMeta: {
  //                     memberDeposits: 100000,
  //                     memberWithdrawals: 50000,
  //                     memberBalance: 50000,
  //                   },
  //                 },
  //               ];

  //         return Promise.resolve({
  //           meta: {
  //             chamaId,
  //             groupMeta: {
  //               groupDeposits: 100000,
  //               groupWithdrawals: 50000,
  //               groupBalance: 50000,
  //             },
  //             memberMeta: members,
  //           },
  //         });
  //       });

  //     // Act
  //     const result = await service.aggregateBulkWalletMeta({
  //       chamaIds,
  //     });

  //     // Assert
  //     expect(result).toBeDefined();
  //     expect(result.meta).toHaveLength(3); // Should still return all 3 results

  //     // Check that the spy was called for each chamaId
  //     expect(spy).toHaveBeenCalledTimes(3);

  //     // The error chama should have default values
  //     const errorChamaMeta = result.meta.find(
  //       (meta) => meta.chamaId === 'error-chama',
  //     );
  //     expect(errorChamaMeta).toBeDefined();
  //     expect(errorChamaMeta.groupMeta).toEqual({
  //       groupDeposits: 0,
  //       groupWithdrawals: 0,
  //       groupBalance: 0,
  //     });
  //     expect(errorChamaMeta.memberMeta).toEqual([]);
  //   });
  // });
});
