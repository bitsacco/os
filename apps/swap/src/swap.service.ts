import {
  btcFromKes,
  Currency,
  OnrampSwapResponse,
  PaginatedOnrampSwapResponse,
  PaginatedRequest,
  QuoteRequest,
  QuoteResponse,
  SwapStatus,
  CreateOnrampSwapDto,
  FindSwapDto,
  CustomStore,
  PaginatedOfframpSwapResponse,
  OfframpSwapResponse,
  CreateOfframpSwapDto,
  kesFromBtc,
} from '@bitsacco/common';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { MpesaOnrampSwap, SwapTransactionState } from '../prisma/client';
import { FxService } from './fx/fx.service';
import { PrismaService } from './prisma.service';
import { IntasendService } from './intasend/intasend.service';
import { MpesaTransactionUpdateDto } from './dto';
import { MpesaTractactionState } from './intasend/intasend.types';
import { FedimintService } from './fedimint/fedimint.service';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);
  private readonly CACHE_TTL_SECS = 60 * 60 * 5;

  constructor(
    private readonly fxService: FxService,
    private readonly intasendService: IntasendService,
    private readonly fedimintService: FedimintService,
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: CustomStore,
  ) {
    this.logger.log('SwapService initialized');
  }

  async getQuote({ from, to, amount }: QuoteRequest): Promise<QuoteResponse> {
    try {
      if (amount && isNaN(Number(amount))) {
        throw new Error('Amount must be a number');
      }

      let convertedAmount: string | undefined;
      let fxRate: string;

      if (from === Currency.KES && to === Currency.BTC) {
        const btcToKesRate = await this.fxService.getBtcToKesRate();
        const amountBtc =
          amount && btcFromKes({ amountKes: Number(amount), btcToKesRate });
        convertedAmount = amountBtc?.toString();
        fxRate = btcToKesRate.toString();
      }

      if (from === Currency.BTC && to === Currency.KES) {
        const kesToBtcRate = await this.fxService.getKesToBtcRate();
        const amountKes =
          amount && kesFromBtc({ amountBtc: Number(amount), kesToBtcRate });
        convertedAmount = amountKes?.toString();
        fxRate = kesToBtcRate.toString();
      }

      const expiry = Math.floor(Date.now() / 1000) + 30 * 60; // 30 mins from now

      const quote: QuoteResponse = {
        id: uuidv4(),
        from,
        to,
        rate: fxRate,
        amount: convertedAmount,
        expiry: expiry.toString(),
      };

      await this.cacheManager.set(quote.id, quote, this.CACHE_TTL_SECS);

      return quote;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async createOnrampSwap({
    quote,
    ref,
    amount,
    phone,
    lightning,
  }: CreateOnrampSwapDto): Promise<OnrampSwapResponse> {
    let currentQuote: QuoteResponse | undefined =
      quote && (await this.cacheManager.get<QuoteResponse>(quote.id));

    if (
      !currentQuote ||
      (Date.now() / 1000 > Number(currentQuote.expiry) &&
        quote.refreshIfExpired)
    ) {
      // create or refresh quote
      currentQuote = await this.getQuote({
        from: Currency.KES,
        to: Currency.BTC,
        amount,
      });
    }

    const mpesa = await this.intasendService.sendMpesaStkPush({
      amount: Number(amount),
      phone_number: phone,
      api_ref: ref,
    });

    // We record stk push response to a temporary cache
    // so we can track status of the swap later
    // NOTE: we use mpesa ids as cache keys
    this.cacheManager.set(
      mpesa.id,
      {
        lightning,
        phone,
        amount,
        rate: currentQuote.rate,
        state: mpesa.state,
        ref,
      },
      this.CACHE_TTL_SECS,
    );

    const swap = await this.prismaService.mpesaOnrampSwap.create({
      data: {
        state: SwapTransactionState.PENDING,
        userId: phone,
        mpesaId: mpesa.id,
        lightning,
        rate: currentQuote.rate,
        retryCount: 0,
      },
    });

    return {
      ...swap,
      status: mapSwapTxStateToSwapStatus(swap.state),
      createdAt: swap.createdAt.toDateString(),
      updatedAt: swap.updatedAt.toDateString(),
    };
  }

  async findOnrampSwap({ id }: FindSwapDto): Promise<OnrampSwapResponse> {
    try {
      // Look up swap in db
      const swap = await this.prismaService.mpesaOnrampSwap.findUniqueOrThrow({
        where: {
          // is this mpesa id or swap id?
          id,
        },
      });

      return {
        ...swap,
        status: mapSwapTxStateToSwapStatus(swap.state),
        retryCount: swap.retryCount,
        createdAt: swap.createdAt.toDateString(),
        updatedAt: swap.updatedAt.toDateString(),
      };
    } catch (e) {
      this.logger.error(e);
      throw new Error('Swap not found in db');
    }
  }

  async listOnrampSwaps({
    page,
    size,
  }: PaginatedRequest): Promise<PaginatedOnrampSwapResponse> {
    const onramps = await this.prismaService.mpesaOnrampSwap.findMany();
    const pages = Math.ceil(onramps.length / size);

    // select the last page if requested page exceeds total pages possible
    const selectPage = page > pages ? pages - 1 : page;

    const swaps = onramps
      .slice(selectPage * size, (selectPage + 1) * size + size)
      .map((swap) => ({
        id: swap.mpesaId,
        rate: swap.rate,
        status: mapSwapTxStateToSwapStatus(swap.state),
        userId: swap.userId,
        mpesaId: swap.mpesaId,
        lightning: swap.lightning,
        retryCount: swap.retryCount,
        createdAt: swap.createdAt.toDateString(),
        updatedAt: swap.updatedAt.toDateString(),
      }));

    return {
      swaps,
      page: selectPage,
      size,
      pages,
    };
  }

  async createOfframpSwap(
    req: CreateOfframpSwapDto,
  ): Promise<OfframpSwapResponse> {
    throw new Error('Method not implemented.');
  }

  async findOfframpSwap({ id }: FindSwapDto): Promise<OfframpSwapResponse> {
    throw new Error('Method not implemented.');
  }

  async listOfframpSwaps({
    page,
    size,
  }: PaginatedRequest): Promise<PaginatedOfframpSwapResponse> {
    throw new Error('Method not implemented.');
  }

  async processSwapUpdate(data: MpesaTransactionUpdateDto) {
    // record mpesa transaction using intasend service
    const mpesa = await this.intasendService.updateMpesaTx(data);

    let swap;
    try {
      swap = await this.prismaService.mpesaOnrampSwap.findUniqueOrThrow({
        where: {
          mpesaId: data.invoice_id,
        },
      });
    } catch {
      // look up mpesa tx in cache
      const stk: STKPushCache = await this.cacheManager.get<STKPushCache>(
        mpesa.id,
      );

      // record a new swap in db
      swap = await this.prismaService.mpesaOnrampSwap.create({
        data: {
          state: SwapTransactionState.PENDING,
          userId: stk.phone,
          mpesaId: mpesa.id,
          lightning: stk.lightning,
          rate: stk.rate,
          retryCount: 0,
        },
      });
    }

    if (!swap) {
      throw new Error('Failed to create or update swap');
    }

    let updates: { state: SwapTransactionState };
    switch (mpesa.state) {
      case MpesaTractactionState.Complete:
        const { state } = await this.swapToBtc(swap);
        updates = { state };
        break;
      case MpesaTractactionState.Processing:
        updates = { state: SwapTransactionState.PROCESSING };
        break;
      case MpesaTractactionState.Failed:
        updates = { state: SwapTransactionState.FAILED };
        break;
      case MpesaTractactionState.Retry:
        updates = { state: SwapTransactionState.RETRY };
        break;
      case MpesaTractactionState.Pending:
        updates = { state: SwapTransactionState.PENDING };
        break;
    }

    await this.prismaService.mpesaOnrampSwap.update({
      where: { id: swap.id },
      data: updates,
    });

    this.logger.log('Swap Updated');
    return;
  }

  private async swapToBtc(
    swap: MpesaOnrampSwap,
  ): Promise<{ state: SwapTransactionState; operationId: string }> {
    this.logger.log('Swapping to BTC');
    this.logger.log('Swap', swap);

    if (
      swap.state === SwapTransactionState.COMPLETE ||
      swap.state === SwapTransactionState.FAILED
    ) {
      throw new Error('Swap transaction alread finalized');
    }

    if (swap.state === SwapTransactionState.PROCESSING) {
      this.logger.log(`Attempting to pay : ${swap.lightning}`);

      const { operationId } = await this.fedimintService.pay(swap.lightning);
      this.logger.log('Completed Onramp Swap', swap.id, operationId);

      return {
        state: SwapTransactionState.COMPLETE,
        operationId,
      };
    }

    throw new Error('Attempted swap to btc while mpesa is still pending');
  }
}

function mapMpesaTxStateToSwapStatus(state: MpesaTractactionState): SwapStatus {
  switch (state) {
    case MpesaTractactionState.Pending:
      return SwapStatus.PENDING;
    case MpesaTractactionState.Failed:
      return SwapStatus.FAILED;
    case MpesaTractactionState.Complete:
      return SwapStatus.COMPLETE;
    case MpesaTractactionState.Retry:
    case MpesaTractactionState.Processing:
      return SwapStatus.PROCESSING;
  }
}

function mapSwapTxStateToSwapStatus(state: SwapTransactionState): SwapStatus {
  switch (state) {
    case SwapTransactionState.PENDING:
      return SwapStatus.PENDING;
    case SwapTransactionState.FAILED:
      return SwapStatus.FAILED;
    case SwapTransactionState.COMPLETE:
      return SwapStatus.COMPLETE;
    case SwapTransactionState.RETRY:
    case SwapTransactionState.PROCESSING:
      return SwapStatus.PROCESSING;
  }
}

interface STKPushCache {
  lightning: string;
  phone: string;
  amount: string;
  rate: string;
  state: MpesaTractactionState;
  ref: string;
}
