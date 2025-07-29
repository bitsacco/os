import {
  Currency,
  QuoteResponse,
  TransactionStatus,
  CreateOnrampSwapDto,
  FindSwapDto,
  PaginatedSwapResponse,
  SwapResponse,
  CreateOfframpSwapDto,
  QuoteDto,
  FedimintContext,
  type FedimintReceiveFailureEvent,
  type FedimintReceiveSuccessEvent,
  type SwapStatusChangeEvent,
  btcToFiat,
  fiatToBtc,
  fedimint_receive_success,
  fedimint_receive_failure,
  swap_status_change,
  FedimintService,
  SupportedCurrencyType,
  PaginatedRequestDto,
  QuoteRequestDto,
  SwapContext,
} from '../common';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MpesaOnrampSwapDocument,
  MpesaOnrampSwapRepository,
  MpesaOfframpSwapRepository,
  SwapTransactionState,
} from './db';
import { FxService } from './fx/fx.service';
import { IntasendService } from './intasend/intasend.service';
import { MpesaTransactionState } from './intasend/intasend.types';
import {
  MpesaCollectionUpdateDto,
  MpesaPaymentUpdateDto,
  isMpesaCollectionUpdate,
} from './intasend/intasend.dto';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);
  private readonly CACHE_TTL_SECS = 60 * 60 * 5;

  constructor(
    private readonly fxService: FxService,
    private readonly intasendService: IntasendService,
    private readonly fedimintService: FedimintService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly offramp: MpesaOfframpSwapRepository,
    private readonly onramp: MpesaOnrampSwapRepository,
  ) {
    this.logger.log('SwapService initialized');

    // Initialize FedimintService
    this.fedimintService.initialize(
      this.configService.get<string>('SWAP_CLIENTD_BASE_URL'),
      this.configService.get<string>('SWAP_FEDERATION_ID'),
      this.configService.get<string>('SWAP_GATEWAY_ID'),
      this.configService.get<string>('SWAP_CLIENTD_PASSWORD'),
    );

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

  async getQuote({
    from,
    to,
    amount,
  }: QuoteRequestDto): Promise<QuoteResponse> {
    try {
      if (amount && isNaN(Number(amount))) {
        throw new Error('Amount must be a number');
      }

      let convertedAmount: string | undefined;
      const fxRate = await this.fxService.getExchangeRate(
        'BTC' as SupportedCurrencyType,
        'KES' as SupportedCurrencyType,
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
    reference,
  }: CreateOnrampSwapDto): Promise<SwapResponse> {
    const rate = await this.getRate(quote, {
      from: Currency.KES,
      to: Currency.BTC,
    });

    const { amountSats } = fiatToBtc({
      amountFiat: Number(amountFiat),
      btcToFiatRate: Number(rate),
    });

    const swap = await this.onramp.create({
      reference,
      state: SwapTransactionState.PENDING,
      lightning: target.payout.invoice,
      amountSats: amountSats.toFixed(2),
      retryCount: 0,
      rate,
      __v: 0,
    });

    const mpesa = await this.intasendService.sendMpesaStkPush({
      amount: Number(amountFiat),
      phone_number: source.origin.phone,
      api_ref: reference,
    });

    const updatedSwap = await this.onramp.findOneAndUpdate(
      { _id: swap._id },
      {
        collectionTracker: mpesa.id,
        state: mapMpesaTxStateToSwapTxState(mpesa.state),
      },
    );

    return {
      ...updatedSwap,
      id: updatedSwap._id.toString(),
      status: mapSwapTxStateToTransactionStatus(swap.state),
      createdAt: swap.createdAt.toDateString(),
      updatedAt: swap.updatedAt.toDateString(),
    };
  }

  async findOnrampSwap({ id }: FindSwapDto): Promise<SwapResponse> {
    try {
      const swap = await this.onramp.findOne({ _id: id });

      return {
        ...swap,
        id: swap._id.toString(),
        status: mapSwapTxStateToTransactionStatus(swap.state),
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
  }: PaginatedRequestDto): Promise<PaginatedSwapResponse> {
    const onramps = await this.onramp.find({});
    const pages = Math.ceil(onramps.length / size);

    // select the last page if requested page exceeds total pages possible
    const selectPage = page > pages ? pages - 1 : page;

    const swaps = onramps
      .slice(selectPage * size, (selectPage + 1) * size)
      .map((swap) => ({
        ...swap,
        id: swap._id.toString(),
        status: mapSwapTxStateToTransactionStatus(swap.state),
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
    amountFiat,
    target,
    reference,
  }: CreateOfframpSwapDto): Promise<SwapResponse> {
    const rate = await this.getRate(quote, {
      from: Currency.BTC,
      to: target.currency,
    });

    const { amountSats, amountMsats } = fiatToBtc({
      amountFiat: Number(amountFiat),
      btcToFiatRate: Number(rate),
    });

    const { invoice: lightning, operationId } =
      await this.fedimintService.invoice(amountMsats, reference);

    const swap = await this.offramp.create({
      rate,
      reference,
      lightning,
      phone: target.payout.phone,
      amountSats: amountSats.toFixed(2),
      paymentTracker: operationId,
      state: SwapTransactionState.PENDING,
      retryCount: 0,
      __v: 0,
    });

    // listen for payment
    this.fedimintService.receive(FedimintContext.OFFRAMP_RECEIVE, operationId);

    return {
      id: swap._id,
      rate: swap.rate,
      userId: swap.paymentTracker,
      lightning: swap.lightning,
      retryCount: swap.retryCount,
      status: mapSwapTxStateToTransactionStatus(
        swap.state as SwapTransactionState,
      ),
      createdAt: swap.createdAt.toDateString(),
      updatedAt: swap.updatedAt.toDateString(),
    };
  }

  async findOfframpSwap({ id }: FindSwapDto): Promise<SwapResponse> {
    try {
      const swap = await this.offramp.findOne({ _id: id });

      return {
        ...swap,
        id: swap._id.toString(),
        status: mapSwapTxStateToTransactionStatus(
          swap.state as SwapTransactionState,
        ),
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
  }: PaginatedRequestDto): Promise<PaginatedSwapResponse> {
    const offramps = await this.offramp.find({});
    const pages = Math.ceil(offramps.length / size);

    // select the last page if requested page exceeds total pages possible
    const selectPage = page > pages ? pages - 1 : page;

    const swaps = offramps
      .slice(selectPage * size, (selectPage + 1) * size + size)
      .map((swap) => ({
        ...swap,
        id: swap._id.toString(),
        status: mapSwapTxStateToTransactionStatus(
          swap.state as SwapTransactionState,
        ),
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

    const swap = await this.onramp.findOne({
      collectionTracker: update.invoice_id,
    });

    if (!swap) {
      throw new Error('Failed to create or update swap');
    }

    let updates: { state: SwapTransactionState };
    switch (mpesa.state) {
      case MpesaTransactionState.Complete:
        // First update to PROCESSING state
        updates = { state: SwapTransactionState.PROCESSING };
        await this.onramp.findOneAndUpdate({ _id: swap._id }, updates);

        // Then trigger the actual BTC swap
        const updatedSwap = await this.onramp.findOne({ _id: swap._id });
        const { state } = await this.swapToBtc(updatedSwap);
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

    await this.onramp.findOneAndUpdate({ _id: swap._id }, updates);

    // Emit swap status change event for onramp swaps
    const txStatus = mapSwapTxStateToTransactionStatus(updates.state);
    const statusEvent: SwapStatusChangeEvent = {
      context: SwapContext.ONRAMP,
      payload: {
        swapTracker: swap._id,
        swapStatus: txStatus,
      },
    };

    this.logger.log(
      `Emitting swap_status_change event for onramp: ${JSON.stringify(statusEvent)}`,
    );
    this.eventEmitter.emit(swap_status_change, statusEvent);

    this.logger.log('Swap Updated');
    return;
  }

  private async swapToBtc(
    swap: MpesaOnrampSwapDocument,
  ): Promise<{ state: SwapTransactionState; operationId?: string }> {
    this.logger.log('Swapping to BTC');
    this.logger.log('Swap', swap);

    if (
      swap.state === SwapTransactionState.COMPLETE ||
      swap.state === SwapTransactionState.FAILED
    ) {
      throw new Error('Swap transaction already finalized');
    }

    if (swap.state === SwapTransactionState.PROCESSING) {
      try {
        this.logger.log(`Attempting to pay : ${swap.lightning}`);

        const { operationId } = await this.fedimintService.pay(swap.lightning);
        this.logger.log('Completed onramp Swap', swap._id, operationId);

        return {
          state: SwapTransactionState.COMPLETE,
          operationId,
        };
      } catch (error) {
        this.logger.error('Failed to complete BTC payment', error);
        return {
          state: SwapTransactionState.FAILED,
        };
      }
    }

    throw new Error('Attempted swap to btc while not in processing state');
  }

  private async processMpesaPaymentUpdate(update: MpesaPaymentUpdateDto) {
    this.logger.log('Processing Mpesa Payment Update');
    const mpesa =
      await this.intasendService.getMpesaTrackerFromPaymentUpdate(update);

    this.logger.log(
      `Looking for offramp swap with paymentTracker: ${update.file_id}`,
    );
    const swap = await this.offramp.findOne({
      paymentTracker: update.file_id,
    });

    if (!swap) {
      this.logger.error(
        `No offramp swap found with paymentTracker: ${update.file_id}`,
      );
      throw new Error('Failed to find swap for update');
    }

    this.logger.log(`Found swap: ${swap._id}, current state: ${swap.state}`);
    const newState = mapMpesaTxStateToSwapTxState(mpesa.state);

    this.logger.log(`Updating swap state from ${swap.state} to ${newState}`);
    const updatedSwap = await this.offramp.findOneAndUpdate(
      { _id: swap._id },
      {
        state: newState,
      },
    );

    // Emit an event with the updated swap status for interested modules
    const txStatus = mapSwapTxStateToTransactionStatus(newState);
    const statusEvent: SwapStatusChangeEvent = {
      context: SwapContext.OFFRAMP,
      payload: {
        swapTracker: swap._id,
        swapStatus: txStatus,
      },
    };

    this.logger.log(
      `Emitting swap_status_change event: ${JSON.stringify(statusEvent)}`,
    );
    this.eventEmitter.emit(swap_status_change, statusEvent);

    this.logger.log(
      `Swap ${swap._id} updated successfully to state: ${newState}`,
    );
    return updatedSwap;
  }

  @OnEvent(fedimint_receive_success)
  private async handleSuccessfulReceive({
    context,
    operationId,
  }: FedimintReceiveSuccessEvent) {
    // Only handle offramp context
    if (context !== FedimintContext.OFFRAMP_RECEIVE) {
      return;
    }

    const swap = await this.offramp.findOne({ paymentTracker: operationId });

    const { amountFiat } = btcToFiat({
      amountSats: Number(swap.amountSats),
      fiatToBtcRate: Number(swap.rate),
    });
    const fee = this.intasendService.calculateWithdrawalFee(amountFiat);

    let statusEvent: SwapStatusChangeEvent;

    try {
      const { id } = await this.intasendService.sendMpesaPayment({
        amount: (amountFiat - fee).toFixed(0).toString(),
        account: swap.phone,
        name: 'bitsacco',
        narrative: 'withdrawal',
      });

      await this.offramp.findOneAndUpdate(
        { _id: swap._id },
        {
          paymentTracker: id,
          state: SwapTransactionState.PROCESSING,
        },
      );

      statusEvent = {
        context: SwapContext.OFFRAMP,
        payload: {
          swapTracker: swap._id,
          swapStatus: TransactionStatus.PROCESSING,
        },
      };
    } catch (error) {
      this.logger.error(`Error when sending mpesa payment: ${error}`);

      await this.offramp.findOneAndUpdate(
        { _id: swap._id },
        {
          state: SwapTransactionState.FAILED,
        },
      );

      statusEvent = {
        context: SwapContext.OFFRAMP,
        payload: {
          swapTracker: swap._id,
          swapStatus: TransactionStatus.FAILED,
          refundable: true,
        },
        error,
      };
    }

    this.logger.log(
      `Emitting swap_status_change event: ${JSON.stringify(statusEvent)}`,
    );
    this.eventEmitter.emit(swap_status_change, statusEvent);

    this.logger.log(
      `Received lightning payment for ${context} : ${operationId}`,
    );
  }

  @OnEvent(fedimint_receive_failure)
  private async handleFailedReceive({
    context,
    operationId,
  }: FedimintReceiveFailureEvent) {
    // Only handle offramp context
    if (context !== FedimintContext.OFFRAMP_RECEIVE) {
      return;
    }

    this.logger.log(
      `Failed to receive lightning payment for ${context} : ${operationId}`,
    );

    const swap = await this.offramp.findOne({ paymentTracker: operationId });

    if (!swap) {
      this.logger.error(`No swap found with paymentTracker ${operationId}`);
      return;
    }

    await this.offramp.findOneAndUpdate(
      { _id: swap._id },
      {
        state: SwapTransactionState.FAILED,
      },
    );

    // Emit an event with the failed status
    const statusEvent: SwapStatusChangeEvent = {
      context: SwapContext.OFFRAMP,
      payload: { swapTracker: swap._id, swapStatus: TransactionStatus.FAILED },
      error: 'Failed to receive lightning payment',
    };

    this.logger.log(
      `Emitting swap_status_change event: ${JSON.stringify(statusEvent)}`,
    );
    this.eventEmitter.emit(swap_status_change, statusEvent);
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

function mapSwapTxStateToTransactionStatus(
  state: SwapTransactionState,
): TransactionStatus {
  switch (state) {
    case SwapTransactionState.PENDING:
      return TransactionStatus.PENDING;
    case SwapTransactionState.FAILED:
      return TransactionStatus.FAILED;
    case SwapTransactionState.COMPLETE:
      return TransactionStatus.COMPLETE;
    case SwapTransactionState.RETRY:
    case SwapTransactionState.PROCESSING:
      return TransactionStatus.PROCESSING;
  }
}
