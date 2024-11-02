import { TestingModule } from '@nestjs/testing';
import {
  createTestingModuleWithValidation,
  EVENTS_SERVICE_BUS,
  SupportedCurrencies,
} from '@bitsacco/common';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { ClientProxy } from '@nestjs/microservices';

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
        ref: 'ref',
        amount: '100',
        phone: '07000000000',
        lightning: 'lnbc1000u1p0j7j0pp5',
      };
      controller.postOnrampTransaction(req);
      expect(swapService.postOnrampTransaction).toHaveBeenCalled();
    });
  });

  describe('getOnrampTransactions', () => {
    it('should call swapService.getOnrampTransactions', () => {
      controller.getOnrampTransactions();
      expect(swapService.getOnrampTransactions).toHaveBeenCalled();
    });
  });

  describe('findOnrampTransaction', () => {
    it('should call swapService.findOnrampTransaction', () => {
      controller.findOnrampTransaction('swap_id');
      expect(swapService.findOnrampTransaction).toHaveBeenCalled();
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
      controller.postOfframpTransaction();
      expect(swapService.postOfframpTransaction).toHaveBeenCalled();
    });
  });

  describe('getOfframpTransactions', () => {
    it('should call swapService.getOfframpTransactions', () => {
      controller.getOfframpTransactions();
      expect(swapService.getOfframpTransactions).toHaveBeenCalled();
    });
  });

  describe('findOfframpTransaction', () => {
    it('should call swapService.findOfframpTransaction', () => {
      controller.findOfframpTransaction();
      expect(swapService.findOfframpTransaction).toHaveBeenCalled();
    });
  });

  describe('postSwapUpdate', () => {
    it('should call swapService.postSwapUpdate', () => {
      controller.postSwapUpdate({});
      expect(serviceBus.emit).toHaveBeenCalled();
    });
  });
});
