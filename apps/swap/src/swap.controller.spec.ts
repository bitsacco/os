import {
  CreateOnrampSwapDto,
  Currency,
  createTestingModuleWithValidation,
} from '@bitsacco/common';
import { TestingModule } from '@nestjs/testing';
import { SwapService } from './swap.service';
import { SwapController } from './swap.controller';

describe('SwapController', () => {
  let swapController: SwapController;
  let swapService: SwapService;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      imports: [],
      controllers: [SwapController],
      providers: [
        {
          provide: SwapService,
          useValue: {
            getQuote: jest.fn(),
            createOnrampSwap: jest.fn(),
            findOnrampSwap: jest.fn(),
          },
        },
      ],
    });

    swapController = app.get<SwapController>(SwapController);
    swapService = app.get<SwapService>(SwapService);
  });

  it('should be defined', () => {
    expect(swapController).toBeDefined();
  });

  it('calls the swapService.getQuote to get a quote', async () => {
    const req = {
      from: Currency.KES,
      to: Currency.BTC,
    };

    await swapController.getQuote(req);
    expect(swapService.getQuote).toHaveBeenCalled();
  });

  it('calls swapService.createOnrampSwap to create a new swap', async () => {
    const req: CreateOnrampSwapDto = {
      quote: {
        id: 'dadad-bdjada-dadad',
        refreshIfExpired: false,
      },
      ref: 'test-onramp-swap',
      amountFiat: '100',
      source: {
        currency: Currency.KES,
        origin: {
          phone: '0700000000',
        },
      },
      target: {
        payout: {
          invoice: 'lnbtcexampleinvoicee',
        },
      },
    };

    await swapController.createOnrampSwap(req);
    expect(swapService.createOnrampSwap).toHaveBeenCalled();
  });

  it('calls swapService.findOnrampSwap to find an ongoing or finalized swap', async () => {
    await swapController.findOnrampSwap({
      id: 'dadad-bdjada-dadad',
    });
    expect(swapService.findOnrampSwap).toHaveBeenCalled();
  });
});
