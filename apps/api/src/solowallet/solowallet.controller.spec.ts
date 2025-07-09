import { TestingModule } from '@nestjs/testing';
import { SolowalletController } from './solowallet.controller';
import {
  SOLOWALLET_SERVICE_NAME,
  CircuitBreakerService,
  SolowalletServiceClient,
} from '@bitsacco/common';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { type ClientGrpc } from '@nestjs/microservices';
import { of } from 'rxjs';
import { provideGrpcMocks } from '../test-utils/grpc-mocks';

describe('SolowalletController', () => {
  let controller: SolowalletController;
  let serviceGenerator: ClientGrpc;
  let solowalletServiceClient: Partial<SolowalletServiceClient>;

  beforeEach(async () => {
    // Create mock for processLnUrlWithdraw
    const mockProcessLnUrlWithdraw = jest
      .fn()
      .mockReturnValue(of({ status: 'OK' }));

    // Create mock for other methods
    solowalletServiceClient = {
      findTransaction: jest.fn().mockReturnValue(of({})),
      depositFunds: jest.fn().mockReturnValue(of({})),
      withdrawFunds: jest.fn().mockReturnValue(of({})),
      userTransactions: jest.fn().mockReturnValue(of({})),
      continueDepositFunds: jest.fn().mockReturnValue(of({})),
      continueWithdrawFunds: jest.fn().mockReturnValue(of({})),
      updateTransaction: jest.fn().mockReturnValue(of({})),
      processLnUrlWithdraw: mockProcessLnUrlWithdraw,
    };

    serviceGenerator = {
      getService: jest.fn().mockReturnValue(solowalletServiceClient),
      getClientByServiceName: jest
        .fn()
        .mockReturnValue(solowalletServiceClient),
    };

    // Create a mock for the CircuitBreakerService
    const mockCircuitBreaker = {
      execute: jest.fn().mockImplementation((serviceKey, observable) => {
        return observable;
      }),
    };

    const jwtAuthMocks = provideJwtAuthStrategyMocks();
    const grpcMocks = provideGrpcMocks(solowalletServiceClient);

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SolowalletController],
      providers: [
        {
          provide: SOLOWALLET_SERVICE_NAME,
          useValue: serviceGenerator,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreaker,
        },
        ...grpcMocks,
        ...jwtAuthMocks,
      ],
    });

    controller = module.get<SolowalletController>(SolowalletController);

    // Manually inject the circuit breaker into the controller if needed
    if (!(controller as any).circuitBreaker) {
      (controller as any).circuitBreaker = mockCircuitBreaker;
    }
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
