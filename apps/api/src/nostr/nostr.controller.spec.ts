import { TestingModule } from '@nestjs/testing';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';

import { NostrController } from './nostr.controller';
import { type ClientGrpc } from '@nestjs/microservices';
import { NOSTR_SERVICE_NAME, NostrServiceClient } from '@bitsacco/common';

describe('NostrController', () => {
  let serviceGenerator: ClientGrpc;
  let nostrController: NostrController;
  let nostrServiceClient: Partial<NostrServiceClient>;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(nostrServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(nostrServiceClient),
    };

    const jwtAuthMocks = provideJwtAuthStrategyMocks();

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [NostrController],
      providers: [
        {
          provide: NOSTR_SERVICE_NAME,
          useValue: serviceGenerator,
        },
        ...jwtAuthMocks,
      ],
    });

    nostrController = module.get<NostrController>(NostrController);
  });

  it('should be defined', () => {
    expect(nostrController).toBeDefined();
  });
});
