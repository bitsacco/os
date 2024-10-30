import {
  btcFromKes,
  Currency,
  OnrampSwapResponse,
  QuoteRequest,
  QuoteResponse,
  SwapStatus,
} from '@bitsacco/common';
import { v4 as uuidv4 } from 'uuid';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SwapTransactionState } from '../prisma/client';
import { FxService } from './fx/fx.service';
import { PrismaService } from './prisma.service';
import { IntasendService } from './intasend/intasend.service';
import {
  CreateOnrampSwapDto,
  FindSwapDto,
  MpesaTransactionUpdateDto,
} from './dto';
import { MpesaTractactionState } from './intasend/intasend.types';
import { FedimintService } from './fedimint/fedimint.service';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);
  private readonly CACHE_TTL_SECS = 1800;

  constructor(
    private readonly fxService: FxService,
    private readonly intasendService: IntasendService,
    private readonly fedimintService: FedimintService,
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.logger.log('SwapService initialized');
  }

  async getQuote({ from, to, amount }: QuoteRequest): Promise<QuoteResponse> {
    try {
      const btcToKesRate = await this.fxService.getBtcToKesRate();

      if (amount && isNaN(Number(amount))) {
        throw new Error('Amount must be a number');
      }

      const amountBtc =
        amount && btcFromKes({ amountKes: Number(amount), btcToKesRate });
      const expiry = Math.floor(Date.now() / 1000) + 30 * 60; // 30 mins from now

      const quote: QuoteResponse = {
        id: uuidv4(),
        from,
        to,
        rate: btcToKesRate.toString(),
        amount: amountBtc?.toString(),
        expiry: expiry.toString(),
      };

      this.cacheManager.set<QuoteResponse>(
        quote.id,
        quote,
        this.CACHE_TTL_SECS,
      );

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
      quote && this.cacheManager.get<QuoteResponse>(quote.id);

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
    this.cacheManager.set<STKPushCache>(
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
      id: swap.id,
      rate: swap.rate,
      status: mapSwapTxStateToSwapStatus(swap.state),
    };
  }

  async findOnrampSwap({ id }: FindSwapDto): Promise<OnrampSwapResponse> {
    let resp: OnrampSwapResponse;
    try {
      // Look up swap in db
      const swap = await this.prismaService.mpesaOnrampSwap.findUniqueOrThrow({
        where: {
          // is this mpesa id or swap id?
          id,
        },
      });

      resp = {
        id,
        rate: swap.rate,
        status: mapSwapTxStateToSwapStatus(swap.state),
      };
    } catch (_error) {
      this.logger.warn(`Swap not found in DB : ${id}`);
    }

    try {
      // Look up stk push response in cache
      // NOTE: we use mpesa ids as cache keys
      const stk: STKPushCache =
        await this.cacheManager.getOrThrow<STKPushCache>(id);

      resp = {
        id,
        rate: stk.rate,
        status: mapMpesaTxStateToSwapStatus(stk.state),
      };
    } catch (_error) {
      this.logger.warn(`Swap not found in cache : ${id}`);
    }

    if (!resp) {
      throw new Error('Swap not found in db or cache');
    }

    return resp;
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
      const stk = await this.cacheManager.getOrThrow(mpesa.id);

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
        const { state } = await this.fedimintService.swapToBtc(swap);
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
