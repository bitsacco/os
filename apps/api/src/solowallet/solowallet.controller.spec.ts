import { Test } from '@nestjs/testing';
import { SolowalletController } from './solowallet.controller';
import { SOLOWALLET_SERVICE_NAME } from '@bitsacco/common';
import { firstValueFrom } from 'rxjs';

describe('SolowalletController', () => {
  let controller: SolowalletController;

  beforeEach(async () => {
    // Create mock for processLnUrlWithdraw
    const mockProcessLnUrlWithdraw = jest.fn().mockImplementation(() => ({
      pipe: jest.fn().mockReturnValue({
        toPromise: jest.fn().mockResolvedValue({ status: 'OK' }),
      }),
    }));

    // Create mock for other methods
    const mockClientMethods = {
      findTransaction: jest.fn(),
      depositFunds: jest.fn(),
      withdrawFunds: jest.fn(),
      userTransactions: jest.fn(),
      continueDepositFunds: jest.fn(),
      continueWithdrawFunds: jest.fn(),
      updateTransaction: jest.fn(),
      processLnUrlWithdraw: mockProcessLnUrlWithdraw,
    };

    const mockGrpcClient = {
      getService: jest.fn().mockReturnValue(mockClientMethods),
    };

    // Override the controller class to remove guards for testing
    const controllerMock = {
      provide: SolowalletController,
      useFactory: () => {
        const original = new SolowalletController(mockGrpcClient as any);
        return original;
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        controllerMock,
        {
          provide: SOLOWALLET_SERVICE_NAME,
          useValue: mockGrpcClient,
        },
      ],
    }).compile();

    controller = module.get<SolowalletController>(SolowalletController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
