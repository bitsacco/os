import { CreateOnrampSwapDto, Currency, JwtAuthGuard } from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: 'AuthService',
          useValue: {
            validateUser: jest.fn(),
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
    await swapController.getOnrampQuote('KES', 100);
    expect(swapService.getQuote).toHaveBeenCalled();
  });

  it('calls swapService.createOnrampSwap to create a new swap', async () => {
    const req: CreateOnrampSwapDto = {
      quote: {
        id: 'dadad-bdjada-dadad',
        refreshIfExpired: false,
      },
      reference: 'test-onramp-swap',
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

    await swapController.postOnrampTransaction(req);
    expect(swapService.createOnrampSwap).toHaveBeenCalled();
  });

  it('calls swapService.findOnrampSwap to find an ongoing or finalized swap', async () => {
    await swapController.findOnrampTransaction('dadad-bdjada-dadad');
    expect(swapService.findOnrampSwap).toHaveBeenCalled();
  });
});
