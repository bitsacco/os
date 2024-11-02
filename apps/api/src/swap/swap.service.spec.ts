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
  const mock_rate = 8708520.117232416; // BTC to KES

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
                btcToKesRate: mock_rate,
              }).toString(),
              expiry: (Math.floor(Date.now() / 1000) + 30 * 60).toString(),
              rate: mock_rate.toString(),
            };
          },
        ),
      createOnrampSwap: jest.fn().mockImplementation(async () => {
        return {
          id: mock_id,
          rate: mock_rate.toString(),
          status: 'PENDING',
        };
      }),
      findOnrampSwap: jest.fn().mockImplementation(async () => {
        return {
          id: mock_id,
          rate: mock_rate.toString(),
          status: 'PENDING',
        };
      }),
      listSwaps: jest.fn().mockImplementation(async () => {
        return {
          swaps: [
            {
              id: mock_id,
              rate: mock_rate.toString(),
              status: 'PENDING',
            },
          ],
          page: 0,
          size: 10,
          pages: 2,
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
            const real = new SwapService(serviceGenerator);
            real.onModuleInit();
            return real;
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

    describe('findOnrampTransaction', () => {
      it('can look up onramp swap tx given id', () => {
        const swap = swapService.findOnrampTransaction({
          id: mock_id,
        });
        expect(swap).toBeDefined();
        expect(mockSwapServiceClient.findOnrampSwap).toHaveBeenCalled();
      });
    });

    describe('getOfframpQuote', () => {
      it('should return status 200', () => {
        expect(swapService.getOfframpQuote()).toEqual({ status: 200 });
      });
    });

    describe('postOfframpTransaction', () => {
      it('should return status 200', () => {
        expect(swapService.postOfframpTransaction()).toEqual({ status: 200 });
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
});
