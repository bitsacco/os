import {
  btcFromKes,
  Currency,
  PaginatedRequest,
  QuoteRequest,
  QuoteResponse,
  SwapStatus,
  CreateOnrampSwapDto,
  FindSwapDto,
  CustomStore,
  PaginatedSwapResponse,
  SwapResponse,
  CreateOfframpSwapDto,
  kesFromBtc,
  QuoteDto,
} from '@bitsacco/common';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { MpesaOnrampSwap, SwapTransactionState } from '../prisma/client';
import { FxService } from './fx/fx.service';
import { PrismaService } from './prisma.service';
import { IntasendService } from './intasend/intasend.service';
import { MpesaTransactionUpdateDto } from './dto';
import { MpesaTractactionState } from './intasend/intasend.types';
import { FedimintService } from './fedimint/fedimint.service';
import {
  fedimint_receive_success,
  fedimint_receive_failure,
  ReceiveContext,
  ReceivePaymentSuccessEvent,
  ReceivePaymentFailureEvent,
} from './fedimint/fedimint.types';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);
  private readonly CACHE_TTL_SECS = 60 * 60 * 5;

  constructor(
    private readonly fxService: FxService,
    private readonly intasendService: IntasendService,
    private readonly fedimintService: FedimintService,
    private readonly prismaService: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CACHE_MANAGER) private readonly cacheManager: CustomStore,
  ) {
    this.logger.log('SwapService initialized');
    this.eventEmitter.on(
      fedimint_receive_success,
      this.handleSuccessfulReceive.bind(this),
    );
    this.eventEmitter.on(
      fedimint_receive_failure,
      this.handleFailedReceive.bind(this),
    );
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

  private async getRate(
    quote: QuoteDto,
    req: {
      amount: string;
      from: Currency;
      to: Currency;
    },
  ): Promise<string> {
    let currentQuote: QuoteResponse | undefined =
      quote && (await this.cacheManager.get<QuoteResponse>(quote.id));

    if (
      !currentQuote ||
      (Date.now() / 1000 > Number(currentQuote.expiry) &&
        quote.refreshIfExpired)
    ) {
      // create or refresh quote
      currentQuote = await this.getQuote(req);
    }

    return currentQuote.rate;
  }

  async createOnrampSwap({
    quote,
    ref,
    amount,
    phone,
    lightning,
  }: CreateOnrampSwapDto): Promise<SwapResponse> {
    const rate = await this.getRate(quote, {
      amount,
      from: Currency.KES,
      to: Currency.BTC,
    });

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
        rate,
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
        rate,
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

  async findOnrampSwap({ id }: FindSwapDto): Promise<SwapResponse> {
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
      throw new Error('onramp swap not found in db');
    }
  }

  async listOnrampSwaps({
    page,
    size,
  }: PaginatedRequest): Promise<PaginatedSwapResponse> {
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

  async createOfframpSwap({
    quote,
    amount,
    ref,
    target,
  }: CreateOfframpSwapDto): Promise<SwapResponse> {
    const rate = await this.getRate(quote, {
      amount,
      from: Currency.BTC,
      to: target.currency,
    });
    const amountMsat = Number(amount) * 1000;

    this.logger.log('Creating offramp swap with ref : ', ref);

    const { invoice: lightning, operationId: id } =
      await this.fedimintService.invoice(amountMsat, ref || 'offramp');

    const swap = await this.prismaService.mpesaOfframpSwap.create({
      data: {
        id,
        state: SwapTransactionState.PENDING,
        rate,
        userId: '254708083339', //target.destination.phone,
        lightning,
        retryCount: 0,
      },
    });

    // listen for payment
    this.fedimintService.receive(ReceiveContext.OFFRAMP, id);

    return {
      ...swap,
      lightning,
      status: mapSwapTxStateToSwapStatus(swap.state),
      createdAt: swap.createdAt.toDateString(),
      updatedAt: swap.updatedAt.toDateString(),
    };
  }

  async findOfframpSwap({ id }: FindSwapDto): Promise<SwapResponse> {
    try {
      // Look up swap in db
      const swap = await this.prismaService.mpesaOfframpSwap.findUniqueOrThrow({
        where: {
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
      throw new Error('offramp swap not found in db');
    }
  }

  async listOfframpSwaps({
    page,
    size,
  }: PaginatedRequest): Promise<PaginatedSwapResponse> {
    const offramps = await this.prismaService.mpesaOfframpSwap.findMany();
    const pages = Math.ceil(offramps.length / size);

    // select the last page if requested page exceeds total pages possible
    const selectPage = page > pages ? pages - 1 : page;

    const swaps = offramps
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

  @OnEvent(fedimint_receive_success)
  private async handleSuccessfulReceive({
    context,
    operationId,
  }: ReceivePaymentSuccessEvent) {
    this.logger.log('Successfully received payment');
    this.logger.log(`Context : ${context}, OperationId: ${operationId}`);
  }

  @OnEvent(fedimint_receive_failure)
  private async handleFailedReceive({
    context,
    operationId,
  }: ReceivePaymentFailureEvent) {
    this.logger.log('Failed to receive payment');
    this.logger.log(`Context : ${context}, OperationId: ${operationId}`);
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
