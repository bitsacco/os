import {
  btcFromKes,
  CreateOfframpSwapDto,
  CreateOnrampSwapDto,
  createTestingModuleWithValidation,
  Currency,
  SwapStatus,
} from '@bitsacco/common';
import { TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { SwapTransactionState } from '../prisma/client';
import { PrismaService } from './prisma.service';
import { FxService } from './fx/fx.service';
import { SwapService } from './swap.service';
import { IntasendService } from './intasend/intasend.service';
import { MpesaTransactionState } from './intasend/intasend.types';
import { FedimintService } from './fedimint/fedimint.service';
import { MpesaCollectionUpdateDto } from './dto';

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
      mpesaOfframpSwap: {
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;

    mockIntasendService = {
      sendMpesaStkPush: jest.fn(),
      getMpesaTrackerFromCollectionUpdate: jest.fn(),
      getMpesaTrackerFromPaymentUpdate: jest.fn(),
    } as unknown as IntasendService;

    mockFedimintService = {
      pay: jest.fn().mockImplementation(() => {
        return {
          state: SwapTransactionState.COMPLETE,
          operationId: '123456789',
        };
      }),
      invoice: jest.fn().mockImplementation(() => {
        return {
          invoice: 'lnbtcexampleinvoicee',
          operationId: '123456789',
        };
      }),
      receive: jest.fn(),
    } as unknown as FedimintService;

    const app: TestingModule = await createTestingModuleWithValidation({
      imports: [EventEmitterModule.forRoot()],
      controllers: [],
      providers: [
        SwapService,
        {
          provide: FxService,
          useValue: {
            getBtcToKesRate: jest.fn().mockResolvedValue(mock_rate),
            getKesToBtcRate: jest.fn().mockResolvedValue(1 / mock_rate),
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
        EventEmitter2,
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

  // Onramp swap tests

  describe('createOnrampSwap', () => {
    it('should create an onramp swap with expected fx rate', async () => {
      (mockIntasendService.sendMpesaStkPush as jest.Mock).mockImplementation(
        () => ({
          id: '123456789',
          state: MpesaTransactionState.Pending,
        }),
      );

      (
        mockPrismaService.mpesaOnrampSwap.create as jest.Mock
      ).mockImplementation(() => ({
        id: 'dadad-bdjada-dadad',
        rate: mock_rate.toString(),
        state: SwapTransactionState.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

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
          invoice: {
            invoice: 'lnbtcexampleinvoicee',
          },
        },
      };

      const swap = await swapService.createOnrampSwap(req);

      expect(swap).toBeDefined();
      expect(swap.rate).toEqual(mock_rate.toString());
      expect(swap.status).toEqual(SwapStatus.PENDING);
    });
  });

  describe('findOnrampSwap', () => {
    it('should lookup a swap in db', async () => {
      expect(
        swapService.findOnrampSwap({
          id: 'dadad-bdjada-dadad',
        }),
      ).rejects.toThrow('onramp swap not found in db');
      expect(
        mockPrismaService.mpesaOnrampSwap.findUniqueOrThrow,
      ).toHaveBeenCalled();
    });
  });

  describe('listOnrampSwaps', () => {
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

      const resp = await swapService.listOnrampSwaps({
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

  describe('processSwapUpdate', () => {
    const req: MpesaCollectionUpdateDto = {
      invoice_id: '123456789',
      state: MpesaTransactionState.Pending,
      failed_reason: null,
      challenge: 'BITSACCO-TEST',
    };

    const swap = {
      id: 'dadad-bdjada-dadad',
      rate: mock_rate.toString(),
      state: SwapTransactionState.PENDING,
    };

    it.skip('creates a new swap tx if there was none recorded before', async () => {
      (mockCacheManager.get as jest.Mock).mockImplementation(
        (_key: string) => ({
          lightning: 'lnbtcexampleinvoicee',
          phone: '0700000000',
          amount: '100',
          rate: mock_rate.toString(),
          ref: 'test-onramp-swap',
          state: MpesaTransactionState.Pending,
        }),
      );

      (
        mockIntasendService.getMpesaTrackerFromCollectionUpdate as jest.Mock
      ).mockImplementation(() => ({
        id: '123456789',
        state: MpesaTransactionState.Pending,
      }));

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
        state: MpesaTransactionState.Processing,
      });
      expect(
        mockIntasendService.getMpesaTrackerFromCollectionUpdate,
      ).toHaveBeenCalled();
      expect(
        mockPrismaService.mpesaOnrampSwap.findUniqueOrThrow,
      ).toHaveBeenCalled();
      expect(mockPrismaService.mpesaOnrampSwap.create).toHaveBeenCalled();
      expect(mockPrismaService.mpesaOnrampSwap.update).toHaveBeenCalled();
    });

    it('should update swap tx from PENDING to PROCESSING', async () => {
      (
        mockIntasendService.getMpesaTrackerFromCollectionUpdate as jest.Mock
      ).mockImplementation(() => ({
        id: '123456789',
        state: MpesaTransactionState.Processing,
      }));

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
        state: MpesaTransactionState.Processing,
      });
      expect(
        mockIntasendService.getMpesaTrackerFromCollectionUpdate,
      ).toHaveBeenCalled();
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
      (
        mockIntasendService.getMpesaTrackerFromCollectionUpdate as jest.Mock
      ).mockImplementation(() => ({
        id: '123456789',
        state: MpesaTransactionState.Complete,
      }));

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
        state: MpesaTransactionState.Complete,
      });
      expect(
        mockIntasendService.getMpesaTrackerFromCollectionUpdate,
      ).toHaveBeenCalled();
      expect(
        mockPrismaService.mpesaOnrampSwap.findUniqueOrThrow,
      ).toHaveBeenCalled();
      expect(mockFedimintService.pay).toHaveBeenCalled();
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

  // Offramp swap tests
  describe('createOfframpSwap', () => {
    it('should create an onramp swap with expected fx rate', async () => {
      (
        mockPrismaService.mpesaOfframpSwap.create as jest.Mock
      ).mockImplementation(() => ({
        id: 'dadad-bdjada-dadad',
        rate: mock_rate.toString(),
        state: SwapTransactionState.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const req: CreateOfframpSwapDto = {
        quote: {
          id: 'dadad-bdjada-dadad',
          refreshIfExpired: false,
        },
        ref: 'test-onramp-swap',
        amountFiat: '100',
        target: {
          currency: Currency.KES,
          destination: {
            phone: '0700000000',
          },
        },
      };

      const swap = await swapService.createOfframpSwap(req);

      expect(swap).toBeDefined();
      expect(swap.rate).toEqual(mock_rate.toString());
      expect(swap.status).toEqual(SwapStatus.PENDING);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });

  describe('findOfframpSwap', () => {
    it('should lookup a swap in db', async () => {
      expect(
        swapService.findOfframpSwap({
          id: 'dadad-bdjada-dadad',
        }),
      ).rejects.toThrow('offramp swap not found in db');
      expect(
        mockPrismaService.mpesaOfframpSwap.findUniqueOrThrow,
      ).toHaveBeenCalled();
    });
  });

  describe('listOfframpSwaps', () => {
    it('should return a paginated list of offramp swaps', async () => {
      (
        mockPrismaService.mpesaOfframpSwap.findMany as jest.Mock
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

      const resp = await swapService.listOfframpSwaps({
        page: 0,
        size: 1,
      });

      expect(mockPrismaService.mpesaOfframpSwap.findMany).toHaveBeenCalled();
      expect(resp).toBeDefined();
      expect(resp.swaps).toHaveLength(1);
      expect(resp.page).toEqual(0);
      expect(resp.size).toEqual(1);
      expect(resp.pages).toEqual(1);
    });
  });
});
