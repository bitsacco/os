import { TestingModule } from '@nestjs/testing';
import {
  CHAMA_WALLET_SERVICE_NAME,
  CHAMAS_SERVICE_NAME,
  ChamasServiceClient,
  ChamaWalletServiceClient,
} from '@bitsacco/common';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { ChamasController } from './chamas.controller';

describe('ChamasController', () => {
  let chamaController: ChamasController;

  let chamasServiceClient: Partial<ChamasServiceClient>;
  let chamaWalletServiceClient: Partial<ChamaWalletServiceClient>;

  beforeEach(async () => {
    const jwtAuthMocks = provideJwtAuthStrategyMocks();

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [ChamasController],
      providers: [
        {
          provide: CHAMAS_SERVICE_NAME,
          useValue: {
            getService: jest.fn().mockReturnValue(chamasServiceClient),
            getClientByServiceName: jest
              .fn()
              .mockReturnValue(chamasServiceClient),
          },
        },
        {
          provide: CHAMA_WALLET_SERVICE_NAME,
          useValue: {
            getService: jest.fn().mockReturnValue(chamaWalletServiceClient),
            getClientByServiceName: jest
              .fn()
              .mockReturnValue(chamaWalletServiceClient),
          },
        },
        ...jwtAuthMocks,
      ],
    });

    chamaController = module.get<ChamasController>(ChamasController);
  });

  it('should be defined', () => {
    expect(chamaController).toBeDefined();
  });
});
