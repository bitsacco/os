import { TestingModule } from '@nestjs/testing';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { SolowalletController } from './solowallet.controller';
import {
  SOLOWALLET_SERVICE_NAME,
  SolowalletServiceClient,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';

describe('SolowalletController', () => {
  let serviceGenerator: ClientGrpc;
  let solowalletController: SolowalletController;
  let solowalletServiceClient: Partial<SolowalletServiceClient>;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(solowalletServiceClient),
      getClientByServiceName: jest
        .fn()
        .mockReturnValue(solowalletServiceClient),
    };

    const jwtAuthMocks = provideJwtAuthStrategyMocks();

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SolowalletController],
      providers: [
        {
          provide: SOLOWALLET_SERVICE_NAME,
          useValue: serviceGenerator,
        },
        ...jwtAuthMocks,
      ],
    });

    solowalletController =
      module.get<SolowalletController>(SolowalletController);
  });

  it('should be defined', () => {
    expect(solowalletController).toBeDefined();
  });
});
