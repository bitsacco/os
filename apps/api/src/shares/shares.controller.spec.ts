import { TestingModule } from '@nestjs/testing';
import { SHARES_SERVICE_NAME, SharesServiceClient } from '@bitsacco/common';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { type ClientGrpc } from '@nestjs/microservices';
import { SharesController } from './shares.controller';

describe.skip('SharesController', () => {
  let serviceGenerator: ClientGrpc;
  let sharesController: SharesController;
  let sharesServiceClient: Partial<SharesServiceClient>;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(sharesServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(sharesServiceClient),
    };

    const jwtAuthMocks = provideJwtAuthStrategyMocks();

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SharesController],
      providers: [
        {
          provide: SHARES_SERVICE_NAME,
          useValue: serviceGenerator,
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
