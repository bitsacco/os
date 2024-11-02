import {
  btcFromKes,
  CreateOnrampSwapDto,
  createTestingModuleWithValidation,
  Currency,
  SwapStatus,
} from '@bitsacco/common';
import { TestingModule } from '@nestjs/testing';
import { SwapTransactionState } from '../prisma/client';
import { PrismaService } from './prisma.service';
import { FxService } from './fx/fx.service';
import { SwapService } from './swap.service';
import { IntasendService } from './intasend/intasend.service';
import { MpesaTractactionState } from './intasend/intasend.types';
import { FedimintService } from './fedimint/fedimint.service';
import { MpesaTransactionUpdateDto } from './dto';

const mock_rate = 8708520.117232416;

describe('SwapService', () => {
  let swapService: SwapService;
  let mockIntasendService: IntasendService;
  let mockFedimintService: FedimintService;
  let mockPrismaService: PrismaService;
  let mockCacheManager: {
    get: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(async () => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    mockPrismaService = {
      $connect: jest.fn(),
      mpesaOnrampSwap: {
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;

    mockIntasendService = {
      sendMpesaStkPush: jest.fn(),
      updateMpesaTx: jest.fn(),
    } as unknown as IntasendService;

    mockFedimintService = {
      swapToBtc: jest.fn().mockImplementation(() => {
        return {
          state: SwapTransactionState.COMPLETE,
          operationId: '123456789',
        };
      }),
    } as unknown as FedimintService;

    const app: TestingModule = await createTestingModuleWithValidation({
      imports: [],
      controllers: [],
      providers: [
        SwapService,
        {
          provide: FxService,
          useValue: {
            getBtcToKesRate: jest.fn().mockResolvedValue(mock_rate),
          },
        },
        {
          provide: IntasendService,
          useValue: mockIntasendService,
        },
        {
          provide: FedimintService,
          useValue: mockFedimintService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'CACHE_MANAGER',
          useValue: mockCacheManager,
        },
      ],
    });

    swapService = app.get<SwapService>(SwapService);
  });

  describe('root', () => {
    it('should be defined', () => {
      expect(swapService).toBeDefined();
    });
  });

  describe('getQuote', () => {
    const req = {
      from: Currency.KES,
      to: Currency.BTC,
    };

    it('should return a quote', async () => {
      const quote = await swapService.getQuote(req);

      expect(quote).toBeDefined();
    });

    it('should return a quote with a valid expiry of more than 10 minutes', async () => {
      const quote = await swapService.getQuote(req);
      const tenMinsFuture = Math.floor(Date.now() / 1000) + 10 * 60;

      expect(quote.expiry).toBeDefined();
      expect(Number(quote.expiry)).toBeGreaterThanOrEqual(tenMinsFuture);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should return a quote with amount, if amount is declared', async () => {
      const amount = '100';
      const quote = await swapService.getQuote({
        ...req,
        amount,
      });

      expect(quote).toBeDefined();
      expect(quote.amount).toBeDefined();
      expect(quote.amount).toEqual(
        btcFromKes({ amountKes: Number(amount), btcToKesRate: mock_rate }),
      );
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should throw an error if amount is not a number string', async () => {
      const amount = 'nan';
      expect(
        swapService.getQuote({
          ...req,
          amount,
        }),
      ).rejects.toThrow('Amount must be a number');
    });
  });

  describe('createOnrampSwap', () => {
    it('should create an onramp swap with expected fx rate', async () => {
      const cache = {
        lightning: 'lnbtcexampleinvoicee',
        phone: '0700000000',
        amount: '100',
        rate: mock_rate.toString(),
        ref: 'test-onramp-swap',
      };

      (mockCacheManager.get as jest.Mock).mockImplementation(
        (_key: string) => cache,
      );

      (mockIntasendService.sendMpesaStkPush as jest.Mock).mockImplementation(
        () => ({
          id: '123456789',
          state: MpesaTractactionState.Pending,
        }),
      );

      (
        mockPrismaService.mpesaOnrampSwap.create as jest.Mock
      ).mockImplementation(() => ({
        id: 'dadad-bdjada-dadad',
        rate: mock_rate.toString(),
        state: SwapTransactionState.PENDING,
      }));

      const req: CreateOnrampSwapDto = {
        quote: {
          id: 'dadad-bdjada-dadad',
          refreshIfExpired: false,
        },
        ref: 'test-onramp-swap',
        phone: cache.phone,
        amount: cache.amount,
        lightning: cache.lightning,
      };

      const swap = await swapService.createOnrampSwap(req);

      expect(swap).toBeDefined();
      expect(swap.rate).toEqual(cache.rate);
      expect(swap.status).toEqual(SwapStatus.PENDING);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });

  describe('findOnrampSwap', () => {
    it('should lookup a swap in db', async () => {
      expect(
        swapService.findOnrampSwap({
          id: 'dadad-bdjada-dadad',
        }),
      ).rejects.toThrow('Swap not found in db or cache');
      expect(
        mockPrismaService.mpesaOnrampSwap.findUniqueOrThrow,
      ).toHaveBeenCalled();
    });

    it('should look up swap in cache if swap is not in db', async () => {
      const cache = {
        lightning: 'lnbtcexampleinvoicee',
        phone: '0700000000',
        amount: '100',
        rate: mock_rate.toString(),
        ref: 'test-onramp-swap',
        state: MpesaTractactionState.Pending,
      };

      (mockCacheManager.get as jest.Mock).mockImplementation(
        (_key: string) => cache,
      );

      const swap = await swapService.findOnrampSwap({
        id: 'dadad-bdjada-dadad',
      });

      expect(swap).toBeDefined();
      expect(swap.rate).toEqual(cache.rate);
      expect(swap.status).toEqual(SwapStatus.PENDING);
      expect(mockCacheManager.get).toHaveBeenCalled();
    });
  });

  describe('processSwapUpdate', () => {
    const req: MpesaTransactionUpdateDto = {
      invoice_id: '123456789',
      state: MpesaTractactionState.Pending,
      charges: '1',
      net_amount: '99',
      currency: 'KES',
      value: '100',
      account: '0700000000',
      api_ref: 'mpesa-onramp',
      retry_count: 0,
      created_at: '2021-08-01T00:00:00Z',
      updated_at: '2024-10-01T00:00:00Z',
      failed_reason: null,
      failed_code: null,
      challenge: 'BITSACCO-TEST',
    };

    const swap = {
      id: 'dadad-bdjada-dadad',
      rate: mock_rate.toString(),
      state: SwapTransactionState.PENDING,
    };

    it('creates a new swap tx if there was none recorded before', async () => {
      (mockCacheManager.get as jest.Mock).mockImplementation(
        (_key: string) => ({
          lightning: 'lnbtcexampleinvoicee',
          phone: '0700000000',
          amount: '100',
          rate: mock_rate.toString(),
          ref: 'test-onramp-swap',
          state: MpesaTractactionState.Pending,
        }),
      );

      (mockIntasendService.updateMpesaTx as jest.Mock).mockImplementation(
        () => ({
          id: '123456789',
          state: MpesaTractactionState.Pending,
        }),
      );

      (mockPrismaService.mpesaOnrampSwap.create as jest.Mock).mockResolvedValue(
        swap,
      );
      (
        mockPrismaService.mpesaOnrampSwap.findUniqueOrThrow as jest.Mock
      ).mockImplementation(() => {
        throw new Error('Not found');
      });
      (
        mockPrismaService.mpesaOnrampSwap.update as jest.Mock
      ).mockImplementation((u) => {
        return {
          ...swap,
          state: u.data.state,
        };
      });

      await swapService.processSwapUpdate({
        ...req,
        state: MpesaTractactionState.Processing,
      });
      expect(mockIntasendService.updateMpesaTx).toHaveBeenCalled();
      expect(
        mockPrismaService.mpesaOnrampSwap.findUniqueOrThrow,
      ).toHaveBeenCalled();
      expect(mockPrismaService.mpesaOnrampSwap.create).toHaveBeenCalled();
      expect(mockPrismaService.mpesaOnrampSwap.update).toHaveBeenCalled();
    });

    it('should update swap tx from PENDING to PROCESSING', async () => {
      (mockIntasendService.updateMpesaTx as jest.Mock).mockImplementation(
        () => ({
          id: '123456789',
          state: MpesaTractactionState.Processing,
        }),
      );

      (
        mockPrismaService.mpesaOnrampSwap.findUniqueOrThrow as jest.Mock
      ).mockResolvedValue(swap);
      (
        mockPrismaService.mpesaOnrampSwap.update as jest.Mock
      ).mockImplementation((u) => {
        return {
          ...swap,
          state: u.data.state,
        };
      });

      await swapService.processSwapUpdate({
        ...req,
        state: MpesaTractactionState.Processing,
      });
      expect(mockIntasendService.updateMpesaTx).toHaveBeenCalled();
      expect(
        mockPrismaService.mpesaOnrampSwap.findUniqueOrThrow,
      ).toHaveBeenCalled();
      expect(mockPrismaService.mpesaOnrampSwap.update).toHaveBeenCalledWith({
        where: {
          id: 'dadad-bdjada-dadad',
        },
        data: {
          state: SwapTransactionState.PROCESSING,
        },
      });
    });

    it('should update swap tx from PROCESSING to COMPLETE', async () => {
      (mockIntasendService.updateMpesaTx as jest.Mock).mockImplementation(
        () => ({
          id: '123456789',
          state: MpesaTractactionState.Complete,
        }),
      );

      (
        mockPrismaService.mpesaOnrampSwap.findUniqueOrThrow as jest.Mock
      ).mockResolvedValue({
        ...swap,
        state: SwapTransactionState.PROCESSING,
      });
      (
        mockPrismaService.mpesaOnrampSwap.update as jest.Mock
      ).mockImplementation((u) => {
        return {
          ...swap,
          state: u.data.state,
        };
      });

      await swapService.processSwapUpdate({
        ...req,
        state: MpesaTractactionState.Complete,
      });
      expect(mockIntasendService.updateMpesaTx).toHaveBeenCalled();
      expect(
        mockPrismaService.mpesaOnrampSwap.findUniqueOrThrow,
      ).toHaveBeenCalled();
      expect(mockFedimintService.swapToBtc).toHaveBeenCalled();
      expect(mockPrismaService.mpesaOnrampSwap.update).toHaveBeenCalled();
      expect(mockPrismaService.mpesaOnrampSwap.update).toHaveBeenCalledWith({
        where: {
          id: 'dadad-bdjada-dadad',
        },
        data: {
          state: SwapTransactionState.COMPLETE,
        },
      });
    });
  });

  describe('listSwaps', () => {
    it('should return a paginated list of swaps', async () => {
      (
        mockPrismaService.mpesaOnrampSwap.findMany as jest.Mock
      ).mockImplementation(() => {
        return [
          {
            mpesaId: 'dadad-bdjada-dadad',
            rate: mock_rate.toString(),
            amount: '100',
            state: SwapTransactionState.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      });

      const resp = await swapService.listSwaps({
        page: 0,
        size: 1,
      });

      expect(mockPrismaService.mpesaOnrampSwap.findMany).toHaveBeenCalled();
      expect(resp).toBeDefined();
      expect(resp.swaps).toHaveLength(1);
      expect(resp.page).toEqual(0);
      expect(resp.size).toEqual(1);
      expect(resp.pages).toEqual(1);
    });
  });
});
