import {
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
  QuoteDto,
  ReceiveContext,
  type ReceivePaymentFailureEvent,
  type ReceivePaymentSuccessEvent,
  fiatToBtc,
  btcToFiat,
} from '@bitsacco/common';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { MpesaOnrampSwap, SwapTransactionState } from '../prisma/client';
import { FxService } from './fx/fx.service';
import { PrismaService } from './prisma.service';
import { IntasendService } from './intasend/intasend.service';
import { MpesaCollectionUpdateDto, MpesaPaymentUpdateDto } from './dto';
import { MpesaTransactionState } from './intasend/intasend.types';
import { FedimintService } from './fedimint/fedimint.service';
import {
  fedimint_receive_success,
  fedimint_receive_failure,
} from './fedimint/fedimint.const';
import { isMpesaCollectionUpdate } from './dto/utils';

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
      const fxRate = await this.fxService.getExchangeRate(
        Currency.BTC,
        Currency.KES,
      );

      if (from === Currency.KES && to === Currency.BTC && amount) {
        const { amountBtc } = fiatToBtc({
          amountFiat: Number(amount),
          btcToFiatRate: fxRate,
        });
        convertedAmount = amountBtc.toFixed(9);
      }

      if (from === Currency.BTC && to === Currency.KES && amount) {
        const { amountFiat } = btcToFiat({
          amountSats: Number(amount),
          fiatToBtcRate: fxRate,
        });
        convertedAmount = amountFiat.toFixed(2);
      }

      const expiry = Math.floor(Date.now() / 1000) + 30 * 60; // 30 mins from now

      const quote: QuoteResponse = {
        id: uuidv4(),
        from,
        to,
        rate: fxRate.toString(),
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
    amountFiat,
    source,
    target,
    ref,
  }: CreateOnrampSwapDto): Promise<SwapResponse> {
    const rate = await this.getRate(quote, {
      from: Currency.KES,
      to: Currency.BTC,
    });

    const { id, state } = await this.intasendService.sendMpesaStkPush({
      amount: Number(amountFiat),
      phone_number: source.origin.phone,
      api_ref: ref,
    });

    const { amountSats } = fiatToBtc({
      amountFiat: Number(amountFiat),
      btcToFiatRate: Number(rate),
    });

    const swap = await this.prismaService.mpesaOnrampSwap.create({
      data: {
        id,
        reference: ref,
        collectionTracker: id,
        state: mapMpesaTxStateToSwapTxState(state),
        lightning: target.invoice.invoice,
        amountSats: amountSats.toFixed(2),
        retryCount: 0,
        rate,
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
        ...swap,
        status: mapSwapTxStateToSwapStatus(swap.state),
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
    ref,
    quote,
    amountFiat,
    target,
  }: CreateOfframpSwapDto): Promise<SwapResponse> {
    const rate = await this.getRate(quote, {
      from: Currency.BTC,
      to: target.currency,
    });

    const { amountSats, amountMsats } = fiatToBtc({
      amountFiat: Number(amountFiat),
      btcToFiatRate: Number(rate),
    });

    const { invoice: lightning, operationId: id } =
      await this.fedimintService.invoice(amountMsats, ref || 'offramp');

    const swap = await this.prismaService.mpesaOfframpSwap.create({
      data: {
        id,
        rate,
        lightning,
        retryCount: 0,
        reference: ref,
        phone: target.destination.phone,
        amountSats: amountSats.toFixed(2),
        state: SwapTransactionState.PENDING,
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
        ...swap,
        status: mapSwapTxStateToSwapStatus(swap.state),
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

  async processSwapUpdate(
    update: MpesaCollectionUpdateDto | MpesaPaymentUpdateDto,
  ) {
    if (isMpesaCollectionUpdate(update)) {
      return this.processMpesaCollectionUpdate(update);
    }

    return this.processMpesaPaymentUpdate(update);
  }

  private async processMpesaCollectionUpdate(update: MpesaCollectionUpdateDto) {
    this.logger.log('Processing Mpesa Collection Update');
    const mpesa =
      await this.intasendService.getMpesaTrackerFromCollectionUpdate(update);

    const swap = await this.prismaService.mpesaOnrampSwap.findUniqueOrThrow({
      where: {
        id: update.invoice_id,
        collectionTracker: update.invoice_id,
      },
    });

    if (!swap) {
      throw new Error('Failed to create or update swap');
    }

    let updates: { state: SwapTransactionState };
    switch (mpesa.state) {
      case MpesaTransactionState.Complete:
        const { state } = await this.swapToBtc(swap);
        updates = { state };
        break;
      case MpesaTransactionState.Processing:
        updates = { state: SwapTransactionState.PROCESSING };
        break;
      case MpesaTransactionState.Failed:
        updates = { state: SwapTransactionState.FAILED };
        break;
      case MpesaTransactionState.Retry:
        updates = { state: SwapTransactionState.RETRY };
        break;
      case MpesaTransactionState.Pending:
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

  private async processMpesaPaymentUpdate(update: MpesaPaymentUpdateDto) {
    this.logger.log('Processing Mpesa Payment Update');
    const mpesa =
      await this.intasendService.getMpesaTrackerFromPaymentUpdate(update);

    const swap = await this.prismaService.mpesaOfframpSwap.findUnique({
      where: {
        paymentTracker: update.file_id,
      },
    });

    if (!swap) {
      throw new Error('Failed to create or update swap');
    }

    await this.prismaService.mpesaOfframpSwap.update({
      where: { id: swap.id },
      data: {
        state: mapMpesaTxStateToSwapTxState(mpesa.state),
      },
    });

    this.logger.log('Swap Updated');
    return;
  }

  @OnEvent(fedimint_receive_success)
  private async handleSuccessfulReceive({
    context,
    operationId,
  }: ReceivePaymentSuccessEvent) {
    this.logger.log('Successfully received payment');
    this.logger.log(`Context : ${context}, OperationId: ${operationId}`);

    const swap = await this.prismaService.mpesaOfframpSwap.findUnique({
      where: { id: operationId },
    });

    const amount = Number(swap.amountSats) * Number(swap.rate);

    const { id } = await this.intasendService.sendMpesaPayment({
      amount: amount.toString(),
      account: swap.phone,
      name: 'bitsacco',
      narrative: 'withdrawal',
    });

    await this.prismaService.mpesaOfframpSwap.update({
      where: { id: operationId },
      data: {
        paymentTracker: id,
        state: SwapTransactionState.PROCESSING,
      },
    });
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

function mapMpesaTxStateToSwapTxState(
  state: MpesaTransactionState,
): SwapTransactionState {
  switch (state) {
    case MpesaTransactionState.Complete:
      return SwapTransactionState.COMPLETE;
    case MpesaTransactionState.Processing:
      return SwapTransactionState.PROCESSING;
    case MpesaTransactionState.Failed:
      return SwapTransactionState.FAILED;
    case MpesaTransactionState.Retry:
      return SwapTransactionState.RETRY;
    case MpesaTransactionState.Pending:
      return SwapTransactionState.PENDING;
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
