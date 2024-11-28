import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { SolowalletController } from './solowallet.controller';
import { SolowalletService } from './solowallet.service';

describe('SolowalletController', () => {
  let controller: SolowalletController;
  let walletService: SolowalletService;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SolowalletController],
      providers: [
        {
          provide: SolowalletService,
          useValue: {
            depositFunds: jest.fn(),
          },
        },
      ],
    });

    controller = module.get<SolowalletController>(SolowalletController);
    walletService = module.get<SolowalletService>(SolowalletService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(walletService).toBeDefined();
  });
});
