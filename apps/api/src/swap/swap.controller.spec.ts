import { TestingModule } from '@nestjs/testing';
import {
  Currency,
  EVENTS_SERVICE_BUS,
  SupportedCurrencies,
} from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ClientProxy } from '@nestjs/microservices';

import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';

describe('SwapController', () => {
  let controller: SwapController;
  let swapService: SwapService;
  let serviceBus: ClientProxy;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SwapController],
      providers: [
        {
          provide: SwapService,
          useValue: {
            getOnrampQuote: jest.fn(),
            postOnrampTransaction: jest.fn(),
            getOnrampTransactions: jest.fn(),
            findOnrampTransaction: jest.fn(),
            getOfframpQuote: jest.fn(),
            postOfframpTransaction: jest.fn(),
            getOfframpTransactions: jest.fn(),
            findOfframpTransaction: jest.fn(),
            postSwapUpdate: jest.fn(),
          },
        },
        {
          provide: EVENTS_SERVICE_BUS,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    });

    controller = module.get<SwapController>(SwapController);
    swapService = module.get<SwapService>(SwapService);
    serviceBus = module.get<ClientProxy>(EVENTS_SERVICE_BUS);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOnrampQuote', () => {
    it('should call swapService.getOnrampQuote', () => {
      controller.getOnrampQuote(SupportedCurrencies.KES);
      expect(swapService.getOnrampQuote).toHaveBeenCalled();
    });

    // it('throws if unsupported currency is supplied', () => {
    //   expect(
    //     controller.getOnrampQuote(SupportedCurrencies.BTC),
    //   ).rejects.toThrow();
    // });

    // it('throws BadRequestException if unsupported currency is supplied', async () => {
    //   await expect(controller.getOnrampQuote(SupportedCurrencies.BTC)).rejects.toThrow(BadRequestException);
    // });
  });

  describe('postOnrampTransaction', () => {
    it('should call swapService.postOnrampTransaction', () => {
      const req = {
        quote: undefined,
        reference: 'ref',
        amountFiat: '100',
        source: {
          currency: Currency.KES,
          origin: {
            phone: '07000000000',
          },
        },
        target: {
          payout: {
            invoice: 'lnbc1000u1p0j7j0pp5',
          },
        },
      };
      controller.postOnrampTransaction(req);
      expect(swapService.postOnrampTransaction).toHaveBeenCalled();
    });
  });

  describe('findOnrampTransaction', () => {
    it('should call swapService.findOnrampTransaction', () => {
      controller.findOnrampTransaction('swap_id');
      expect(swapService.findOnrampTransaction).toHaveBeenCalled();
    });
  });

  describe('getOnrampTransactions', () => {
    it('should call swapService.getOnrampTransactions', () => {
      controller.getOnrampTransactions();
      expect(swapService.getOnrampTransactions).toHaveBeenCalled();
    });
  });

  describe('getOfframpQuote', () => {
    it('should call swapService.getOfframpQuote', () => {
      controller.getOfframpQuote(SupportedCurrencies.KES);
      expect(swapService.getOfframpQuote).toHaveBeenCalled();
    });
  });

  describe('postOfframpTransaction', () => {
    it('should call swapService.postOfframpTransaction', () => {
      const req = {
        quote: undefined,
        reference: 'ref',
        amountFiat: '100',
        target: {
          currency: SupportedCurrencies.KES,
          payout: {
            phone: '07000000000',
          },
        },
      };
      controller.postOfframpTransaction(req);
      expect(swapService.postOfframpTransaction).toHaveBeenCalled();
    });
  });

  describe('getOfframpTransactions', () => {
    it('should call swapService.getOfframpTransactions', () => {
      controller.getOfframpTransactions();
      expect(swapService.getOfframpTransactions).toHaveBeenCalled();
    });
  });

  describe('postSwapUpdate', () => {
    it('should call swapService.postSwapUpdate', () => {
      controller.postSwapUpdate({});
      expect(serviceBus.emit).toHaveBeenCalled();
    });
  });

  describe('findOfframpTransaction', () => {
    it('should call swapService.findOfframpTransaction', () => {
      controller.findOfframpTransaction('swap_id');
      expect(swapService.findOfframpTransaction).toHaveBeenCalled();
    });
  });

  describe('getOfframpTransactions', () => {
    it('should call swapService.getOfframpTransactions', () => {
      controller.getOfframpTransactions();
      expect(swapService.getOfframpTransactions).toHaveBeenCalled();
    });
  });
});
