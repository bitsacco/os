import { TestingModule } from '@nestjs/testing';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';

import { NostrController } from './nostr.controller';
import { type ClientGrpc } from '@nestjs/microservices';
import {
  NOSTR_SERVICE_NAME,
  NostrServiceClient,
  CircuitBreakerService,
} from '@bitsacco/common';
import { provideGrpcMocks } from '../test-utils/grpc-mocks';

describe('NostrController', () => {
  let serviceGenerator: ClientGrpc;
  let nostrController: NostrController;
  let nostrServiceClient: Partial<NostrServiceClient>;

  beforeEach(async () => {
    nostrServiceClient = {};

    serviceGenerator = {
      getService: jest.fn().mockReturnValue(nostrServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(nostrServiceClient),
    };

    const jwtAuthMocks = provideJwtAuthStrategyMocks();
    const grpcMocks = provideGrpcMocks(nostrServiceClient);

    // Create a mock for the CircuitBreakerService
    const mockCircuitBreaker = {
      execute: jest.fn().mockImplementation((serviceKey, observable) => {
        return observable;
      }),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [NostrController],
      providers: [
        {
          provide: NOSTR_SERVICE_NAME,
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

    nostrController = module.get<NostrController>(NostrController);
  });

  it('should be defined', () => {
    expect(nostrController).toBeDefined();
  });
});
