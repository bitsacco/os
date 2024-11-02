import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { ClientGrpc } from '@nestjs/microservices';
import {
  btcFromKes,
  createTestingModuleWithValidation,
  Currency,
  type QuoteRequest,
  type QuoteResponse,
  SWAP_SERVICE_NAME,
  SwapServiceClient,
} from '@bitsacco/common';
import { SwapService } from './swap.service';

describe('SwapService', () => {
  let swapService: SwapService;
  let serviceGenerator: ClientGrpc;
  let mockSwapServiceClient: Partial<SwapServiceClient>;

  const mock_id = '6f7f6d3f-c54e-4a34-a80d-a9e3c023abf3';
  const mock_btc_kes = 8708520.117232416; // BTC to KES

  beforeAll(() => {
    // gRpc client that actually talks to the microservice
    mockSwapServiceClient = {
      // Add any methods from SwapServiceClient that you need to mock
      getQuote: jest
        .fn()
        .mockImplementation(
          ({ from, to, amount }: QuoteRequest): QuoteResponse => {
            return {
              id: mock_id,
              from,
              to,
              amount: btcFromKes({
                amountKes: Number(amount),
                btcToKesRate: mock_btc_kes,
              }).toString(),
              expiry: (Math.floor(Date.now() / 1000) + 30 * 60).toString(),
              rate: mock_btc_kes.toString(),
            };
          },
        ),
      createOnrampSwap: jest.fn().mockImplementation(async () => {
        return {
          id: mock_id,
          rate: mock_btc_kes.toString(),
          status: 'PENDING',
        };
      }),
      findOnrampSwap: jest.fn().mockImplementation(async () => {
        return {
          id: mock_id,
          rate: mock_btc_kes.toString(),
          status: 'PENDING',
        };
      }),
      listOnrampSwaps: jest.fn().mockImplementation(async () => {
        return {
          swaps: [
            {
              id: mock_id,
              rate: mock_btc_kes.toString(),
              status: 'PENDING',
            },
          ],
          page: 0,
          size: 10,
          pages: 2,
        };
      }),
      createOfframpSwap: jest.fn().mockImplementation(async () => {
        return {
          id: mock_id,
          rate: (1 / mock_btc_kes).toString(),
          status: 'PENDING',
        };
      }),
    };
  });

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(mockSwapServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(mockSwapServiceClient),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [
        ConfigService,
        {
          provide: SwapService,
          useFactory: () => {
            return new SwapService(serviceGenerator);
          },
        },
        {
          provide: SWAP_SERVICE_NAME,
          useValue: serviceGenerator,
        },
      ],
    });

    swapService = module.get<SwapService>(SwapService);
  });

  it('should be defined', () => {
    expect(swapService).toBeDefined();
  });

  describe('getOnrampQuote', () => {
    it('can request quote', () => {
      const quote = swapService.getOnrampQuote({
        from: Currency.KES,
        to: Currency.BTC,
        amount: '1',
      });
      expect(quote).toBeDefined();
      expect(mockSwapServiceClient.getQuote).toHaveBeenCalled();
    });
  });

  describe('postOnrampTransaction', () => {
    it('can initiate an onramp swap without a quote', () => {
      const swap = swapService.postOnrampTransaction({
        quote: undefined,
        ref: '1234',
        amount: '100',
        phone: '0700000000',
        lightning: 'lnbc1000u1p0j7j0pp5',
      });
      expect(swap).toBeDefined();
      expect(mockSwapServiceClient.createOnrampSwap).toHaveBeenCalled();
    });

    it('can initiate an onramp swap with a quote', () => {
      const swap = swapService.postOnrampTransaction({
        ref: '1234',
        amount: '100',
        phone: '0700000000',
        lightning: 'lnbc1000u1p0j7j0pp5',
        quote: {
          id: mock_id,
          refreshIfExpired: true,
        },
      });
      expect(swap).toBeDefined();
      expect(mockSwapServiceClient.createOnrampSwap).toHaveBeenCalled();
    });
  });

  describe('findOnrampTransaction', () => {
    it('can look up onramp swap tx given id', () => {
      const swap = swapService.findOnrampTransaction({
        id: mock_id,
      });
      expect(swap).toBeDefined();
      expect(mockSwapServiceClient.findOnrampSwap).toHaveBeenCalled();
    });
  });

  describe('getOnrampTransactions', () => {
    it('should return status 200', () => {
      expect(
        swapService.getOnrampTransactions({
          page: 0,
          size: 10,
        }),
      ).toBeDefined();
    });
  });

  describe('getOfframpQuote', () => {
    it('can request quote', () => {
      const quote = swapService.getOfframpQuote({
        from: Currency.BTC,
        to: Currency.KES,
        amount: '1',
      });
      expect(quote).toBeDefined();
      expect(mockSwapServiceClient.getQuote).toHaveBeenCalled();
    });
  });

  describe('postOfframpTransaction', () => {
    it('can initiate an offramp swap without a quote', () => {
      const swap = swapService.postOfframpTransaction({
        quote: undefined,
        ref: '1234',
        amount: '100',
        target: {
          currency: Currency.KES,
          destination: {
            phone: '0700000000',
          },
        },
      });
      expect(swap).toBeDefined();
      expect(mockSwapServiceClient.createOfframpSwap).toHaveBeenCalled();
    });

    it('can initiate an offramp swap with a quote', () => {
      const swap = swapService.postOfframpTransaction({
        ref: '1234',
        amount: '100',
        target: {
          currency: Currency.KES,
          destination: {
            phone: '0700000000',
          },
        },
        quote: {
          id: mock_id,
          refreshIfExpired: true,
        },
      });
      expect(swap).toBeDefined();
      expect(mockSwapServiceClient.createOfframpSwap).toHaveBeenCalled();
    });
  });

  describe('getOfframpTransactions', () => {
    it('should return status 200', () => {
      expect(swapService.getOfframpTransactions()).toEqual({ status: 200 });
    });
  });

  describe('findOfframpTransaction', () => {
    it('should return status 200', () => {
      expect(swapService.findOfframpTransaction()).toEqual({ status: 200 });
    });
  });
});
