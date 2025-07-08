import { TestingModule } from '@nestjs/testing';
import {
  SHARES_SERVICE_NAME,
  SharesServiceClient,
  CircuitBreakerService,
} from '@bitsacco/common';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { type ClientGrpc } from '@nestjs/microservices';
import { SharesController } from './shares.controller';

describe('SharesController', () => {
  let serviceGenerator: ClientGrpc;
  let sharesController: SharesController;
  let sharesServiceClient: Partial<SharesServiceClient>;

  beforeEach(async () => {
    sharesServiceClient = {};

    serviceGenerator = {
      getService: jest.fn().mockReturnValue(sharesServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(sharesServiceClient),
    };

    const jwtAuthMocks = provideJwtAuthStrategyMocks();

    // Create a mock for the CircuitBreakerService
    const mockCircuitBreaker = {
      execute: jest.fn().mockImplementation((serviceKey, observable) => {
        return observable;
      }),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SharesController],
      providers: [
        {
          provide: SHARES_SERVICE_NAME,
          useValue: serviceGenerator,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreaker,
        },
        ...jwtAuthMocks,
      ],
    });

    sharesController = module.get<SharesController>(SharesController);
  });

  it('should be defined', () => {
    expect(sharesController).toBeDefined();
  });
});
