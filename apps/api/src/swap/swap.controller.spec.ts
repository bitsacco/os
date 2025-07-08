import { TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';
import {
  Currency,
  EVENTS_SERVICE_BUS,
  SupportedCurrencies,
  SWAP_SERVICE_NAME,
  SwapServiceClient,
  CircuitBreakerService,
} from '@bitsacco/common';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { type ClientGrpc, ClientProxy } from '@nestjs/microservices';

import { SwapController } from './swap.controller';

describe('SwapController', () => {
  let serviceGenerator: ClientGrpc;
  let swapController: SwapController;
  let circuitBreakerService: CircuitBreakerService;

  const swapServiceClient: SwapServiceClient = {
    getQuote: jest.fn().mockReturnValue(of({})),
    createOnrampSwap: jest.fn().mockReturnValue(of({})),
    findOnrampSwap: jest.fn().mockReturnValue(of({})),
    listOnrampSwaps: jest.fn().mockReturnValue(of({})),
    createOfframpSwap: jest.fn().mockReturnValue(of({})),
    findOfframpSwap: jest.fn().mockReturnValue(of({})),
    listOfframpSwaps: jest.fn().mockReturnValue(of({})),
  };
  let serviceBus: ClientProxy;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(swapServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(swapServiceClient),
    };

    const jwtAuthMocks = provideJwtAuthStrategyMocks();

    // Create a mock for the CircuitBreakerService
    const mockCircuitBreaker = {
      execute: jest.fn().mockImplementation((serviceKey, observable) => {
        return observable;
      }),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SwapController],
      providers: [
        {
          provide: SWAP_SERVICE_NAME,
          useValue: serviceGenerator,
        },
        {
          provide: EVENTS_SERVICE_BUS,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreaker,
        },
        ...jwtAuthMocks,
      ],
    });

    swapController = module.get<SwapController>(SwapController);
    serviceBus = module.get<ClientProxy>(EVENTS_SERVICE_BUS);
    circuitBreakerService = module.get<CircuitBreakerService>(
      CircuitBreakerService,
    );

    // Manually inject the circuit breaker into the controller if needed
    if (!(swapController as any).circuitBreaker) {
      (swapController as any).circuitBreaker = circuitBreakerService;
    }
  });

  it('should be defined', () => {
    expect(swapController).toBeDefined();
  });

  describe('getOnrampQuote', () => {
    it('should call swapService.getOnrampQuote', () => {
      swapController.getOnrampQuote(SupportedCurrencies.KES);
      expect(circuitBreakerService.execute).toHaveBeenCalled();
      expect(swapServiceClient.getQuote).toHaveBeenCalled();
    });

    // it('throws if unsupported currency is supplied', async () => {
    //   await expect(
    //     swapController.getOnrampQuote(SupportedCurrencies.BTC),
    //   ).rejects.toThrow(
    //     new BadRequestException('Invalid currency. Only KES is supported'),
    //   );
    // });

    // it('throws BadRequestException if unsupported currency is supplied', async () => {
    //   await expect(swapController.getOnrampQuote(SupportedCurrencies.BTC)).rejects.toThrow(BadRequestException);
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
      swapController.postOnrampTransaction(req);
      expect(swapServiceClient.createOnrampSwap).toHaveBeenCalled();
    });
  });

  describe('findOnrampTransaction', () => {
    it('should call swapService.findOnrampTransaction', () => {
      swapController.findOnrampTransaction('swap_id');
      expect(swapServiceClient.findOnrampSwap).toHaveBeenCalled();
    });
  });

  describe('getOnrampTransactions', () => {
    it('should call swapService.getOnrampTransactions', () => {
      swapController.getOnrampTransactions();
      expect(swapServiceClient.listOnrampSwaps).toHaveBeenCalled();
    });
  });

  describe('getOfframpQuote', () => {
    it('should call swapService.getOfframpQuote', () => {
      swapController.getOfframpQuote(SupportedCurrencies.KES);
      expect(swapServiceClient.getQuote).toHaveBeenCalled();
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
      swapController.postOfframpTransaction(req);
      expect(swapServiceClient.createOfframpSwap).toHaveBeenCalled();
    });
  });

  describe('getOfframpTransactions', () => {
    it('should call swapService.getOfframpTransactions', () => {
      swapController.getOfframpTransactions();
      expect(swapServiceClient.listOfframpSwaps).toHaveBeenCalled();
    });
  });

  describe('postSwapUpdate', () => {
    it('should call swapService.postSwapUpdate', () => {
      swapController.postSwapUpdate({});
      expect(serviceBus.emit).toHaveBeenCalled();
    });
  });

  describe('findOfframpTransaction', () => {
    it('should call swapService.findOfframpTransaction', () => {
      swapController.findOfframpTransaction('swap_id');
      expect(swapServiceClient.findOfframpSwap).toHaveBeenCalled();
    });
  });
});
