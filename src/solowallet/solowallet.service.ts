import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Currency,
  DepositFundsRequestDto,
  WalletMeta,
  fedimint_receive_failure,
  fedimint_receive_success,
  swap_status_change,
  FedimintService,
  UserTxsResponse,
  UserTxsRequestDto,
  PaginatedSolowalletTxsResponse,
  FedimintContext,
  type FedimintReceiveFailureEvent,
  type FedimintReceiveSuccessEvent,
  type SwapStatusChangeEvent,
  TransactionStatus,
  TransactionType,
  WithdrawFundsRequestDto,
  UpdateTxDto,
  default_page,
  default_page_size,
  SolowalletTx,
  FindTxRequestDto,
  FmLightning,
  ContinueDepositFundsRequestDto,
  ContinueWithdrawFundsRequestDto,
  fiatToBtc,
  btcToFiat,
  validateStateTransition,
  SOLO_WALLET_STATE_TRANSITIONS,
  TimeoutConfigService,
  TimeoutTransactionType,
  WalletType,
} from '../common';
import { SolowalletMetricsService } from './solowallet.metrics';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SolowalletDocument, SolowalletRepository, toSolowalletTx } from './db';
import { SwapService } from '../swap/swap.service';

@Injectable()
export class SolowalletService {
  private readonly logger = new Logger(SolowalletService.name);

  constructor(
    private readonly wallet: SolowalletRepository,
    private readonly fedimintService: FedimintService,
    private readonly eventEmitter: EventEmitter2,
    private readonly solowalletMetricsService: SolowalletMetricsService,
    private readonly swapService: SwapService,
    private readonly timeoutConfigService: TimeoutConfigService,
  ) {
    this.logger.log('SolowalletService created');
    this.eventEmitter.on(
      fedimint_receive_success,
      this.handleSuccessfulReceive.bind(this),
    );
    this.eventEmitter.on(
      fedimint_receive_failure,
      this.handleFailedReceive.bind(this),
    );
    this.eventEmitter.on(
      swap_status_change,
      this.handleSwapStatusChange.bind(this),
    );
    this.logger.log('SolowalletService initialized');
  }

  private async getPaginatedUserTxLedger({
    userId,
    pagination,
    priority,
  }: UserTxsRequestDto & {
    priority?: string;
  }): Promise<PaginatedSolowalletTxsResponse> {
    let allTx = await this.wallet.find({ userId }, { createdAt: -1 });

    if (priority) {
      const priorityTx = allTx.find((tx) => tx._id.toString() === priority);
      if (!priorityTx) {
        throw new NotFoundException(
          `Transaction with id ${priority} not found`,
        );
      }

      allTx = [
        priorityTx,
        ...allTx.filter((tx) => tx._id.toString() !== priority),
      ];
    }

    const { page, size } = pagination || {
      page: default_page,
      size: default_page_size,
    };
    const pages = Math.ceil(allTx.length / size);

    // select the last page if requested page exceeds total pages possible
    const selectPage = page > pages ? pages - 1 : page;

    const transactions = allTx
      .slice(selectPage * size, (selectPage + 1) * size)
      .map((doc) => toSolowalletTx(doc, this.logger));

    return {
      transactions,
      page: selectPage,
      size,
      pages,
    };
  }

  private async updateTransactionStatus(
    transactionId: string,
    newStatus: TransactionStatus,
    currentVersion: number,
    additionalUpdates: any = {},
  ): Promise<any> {
    const now = new Date();
    let timeoutAt = undefined;

    // Set timeout based on new status
    if (
      newStatus === TransactionStatus.PENDING ||
      newStatus === TransactionStatus.PROCESSING
    ) {
      timeoutAt = this.timeoutConfigService.calculateTimeoutDate(newStatus);
    }

    return this.wallet.findOneAndUpdateWithVersion(
      { _id: transactionId },
      {
        status: newStatus,
        stateChangedAt: now,
        timeoutAt,
        ...additionalUpdates,
      },
      currentVersion,
    );
  }

  private async aggregateTransactionsByStatus(
    userId: string,
    type: TransactionType,
    status: TransactionStatus | TransactionStatus[],
  ): Promise<number> {
    let transactions: number = 0;
    try {
      if (!this.wallet) {
        this.logger.warn(
          'Wallet repository not available, returning 0 for aggregation',
        );
        return 0;
      }

      const statusFilter = Array.isArray(status)
        ? { $in: status.map((s) => s.toString()) }
        : status.toString();

      transactions = await this.wallet
        .aggregate([
          {
            $match: {
              userId: userId,
              status: statusFilter,
              type: type.toString(),
            },
          },
          {
            $group: {
              _id: null,
              totalMsats: { $sum: '$amountMsats' },
            },
          },
        ])
        .then((result) => {
          return result[0]?.totalMsats || 0;
        });
    } catch (e) {
      this.logger.error(
        `Error aggregating ${Array.isArray(status) ? status.join(', ') : status} transactions`,
        e,
      );
    }

    return transactions;
  }

  private async aggregateUserTransactions(
    userId: string,
    type: TransactionType,
  ): Promise<number> {
    return this.aggregateTransactionsByStatus(
      userId,
      type,
      TransactionStatus.COMPLETE,
    );
  }

  private async aggregateProcessingTransactions(
    userId: string,
    type: TransactionType,
  ): Promise<number> {
    return this.aggregateTransactionsByStatus(
      userId,
      type,
      TransactionStatus.PROCESSING,
    );
  }

  private async getWalletMeta(userId: string): Promise<WalletMeta> {
    const totalDeposits = await this.aggregateUserTransactions(
      userId,
      TransactionType.DEPOSIT,
    );
    const totalWithdrawals = await this.aggregateUserTransactions(
      userId,
      TransactionType.WITHDRAW,
    );
    const processingWithdrawals = await this.aggregateProcessingTransactions(
      userId,
      TransactionType.WITHDRAW,
    );

    return {
      totalDeposits,
      totalWithdrawals,
      currentBalance: totalDeposits - totalWithdrawals - processingWithdrawals,
    };
  }

  async depositFunds({
    userId,
    amountFiat,
    amountMsats: requestedAmountMsats,
    reference,
    onramp,
    pagination,
    walletId,
    walletType,
  }: DepositFundsRequestDto & {
    walletId?: string;
    walletType?: WalletType;
  }): Promise<UserTxsResponse> {
    const startTime = Date.now();
    let errorType: string | undefined;

    try {
      // Validate that either amountFiat or amountMsats is provided
      if (!amountFiat && !requestedAmountMsats) {
        throw new BadRequestException(
          'Either amountFiat or amountMsats must be provided',
        );
      }

      if (amountFiat && requestedAmountMsats) {
        throw new BadRequestException(
          'Cannot specify both amountFiat and amountMsats',
        );
      }

      let finalAmountMsats: number;
      let finalAmountFiat: number;
      let quote: any;

      if (requestedAmountMsats) {
        // Direct msats mode - for Lightning Address payments
        if (onramp) {
          throw new BadRequestException(
            'amountMsats cannot be used with onramp payments',
          );
        }
        finalAmountMsats = requestedAmountMsats;

        // Get exchange rate to calculate fiat equivalent for tracking
        quote = await this.swapService.getQuote({
          from: Currency.KES,
          to: Currency.BTC,
          amount: '1',
        });

        const { amountFiat: calculatedAmountFiat } = btcToFiat({
          amountMsats: finalAmountMsats,
          fiatToBtcRate: Number(quote.rate),
        });
        finalAmountFiat = calculatedAmountFiat;

        this.logger.log(
          `Direct msats mode: ${finalAmountMsats} msats, calculated fiat equivalent: ${finalAmountFiat}`,
        );
      } else {
        // Fiat mode - traditional flow
        quote = await this.swapService.getQuote({
          from: onramp?.currency || Currency.KES,
          to: Currency.BTC,
          amount: amountFiat!.toString(),
        });

        const { amountMsats } = fiatToBtc({
          amountFiat: Number(amountFiat!),
          btcToFiatRate: Number(quote.rate),
        });

        finalAmountMsats = amountMsats;
        finalAmountFiat = amountFiat!;

        this.logger.log(
          `Fiat mode: ${finalAmountFiat} fiat, calculated amountMsats: ${finalAmountMsats}`,
        );
      }

      const lightning = await this.fedimintService.invoice(
        finalAmountMsats,
        reference,
      );

      let paymentTracker: string;
      let status: TransactionStatus;

      if (onramp) {
        const swapResponse = await this.swapService.createOnrampSwap({
          quote: {
            id: quote.id,
            refreshIfExpired: false,
          },
          amountFiat: finalAmountFiat.toString(),
          reference,
          source: onramp,
          target: {
            payout: lightning,
          },
        });
        status = swapResponse.status;
        paymentTracker = swapResponse.id; // Use swap ID as payment tracker for onramp
        this.logger.log(`Created onramp swap with id: ${swapResponse.id}`);
      } else {
        status = TransactionStatus.PENDING;
        paymentTracker = lightning.operationId; // Use operation ID for direct lightning deposits
      }

      this.logger.log(`Status: ${status}, paymentTracker: ${paymentTracker}`);
      const now = new Date();
      const timeoutAt = this.timeoutConfigService.calculateTimeoutDate(
        TransactionStatus.PENDING,
        TimeoutTransactionType.DEPOSIT,
      );

      const deposit = await this.wallet.create({
        userId,
        amountMsats: finalAmountMsats,
        amountFiat: finalAmountFiat,
        lightning: JSON.stringify(lightning),
        paymentTracker,
        type: TransactionType.DEPOSIT,
        status,
        reference,
        stateChangedAt: now,
        timeoutAt: status === TransactionStatus.PENDING ? timeoutAt : undefined,
        retryCount: 0,
        maxRetries: 3,
        __v: 0,
        // Add wallet context for personal savings features (backward compatible)
        walletId: walletId || undefined,
        walletType: (walletType as WalletType) || WalletType.STANDARD,
      });

      // listen for payment (only for direct lightning deposits, not onramp)
      if (!onramp) {
        this.fedimintService.receive(
          FedimintContext.SOLOWALLET_RECEIVE,
          lightning.operationId,
        );
      }

      const ledger = await this.getPaginatedUserTxLedger({
        userId,
        pagination,
        priority: deposit._id,
      });

      const meta = await this.getWalletMeta(userId);

      // Record successful deposit metrics

      // Record metrics for this operation
      this.solowalletMetricsService.recordDepositMetric({
        userId,
        amountMsats: finalAmountMsats,
        amountFiat: finalAmountFiat,
        method: onramp ? 'onramp' : 'lightning',
        success: true,
        duration: Date.now() - startTime,
      });

      // Record balance metrics
      this.solowalletMetricsService.recordBalanceMetric({
        userId,
        balanceMsats: meta.currentBalance,
        activity: 'deposit',
      });

      return {
        txId: deposit._id,
        ledger,
        meta,
        userId,
      };
    } catch (error) {
      errorType = error.message || 'Unknown error';
      this.logger.error(`Deposit failed: ${errorType}`, error.stack);

      // Record failed deposit metrics
      this.solowalletMetricsService.recordDepositMetric({
        userId,
        amountMsats: 0,
        amountFiat,
        method: onramp ? 'onramp' : 'lightning',
        success: false,
        duration: Date.now() - startTime,
        errorType,
      });

      throw error;
    }
  }

  async continueDepositFunds({
    userId,
    txId,
    amountFiat,
    onramp,
    pagination,
  }: ContinueDepositFundsRequestDto): Promise<UserTxsResponse> {
    const tx = await this.wallet.findOne({ _id: txId });

    if (tx.userId !== userId) {
      throw new Error('Invalid request to continue transaction');
    }

    if (
      tx.status === TransactionStatus.COMPLETE ||
      tx.status === TransactionStatus.PROCESSING
    ) {
      throw new Error('Transaction is processing or complete');
    }

    const quote = await this.swapService.getQuote({
      from: onramp?.currency || Currency.KES,
      to: Currency.BTC,
      amount: amountFiat.toString(),
    });

    const { amountMsats } = fiatToBtc({
      amountFiat: Number(amountFiat),
      btcToFiatRate: Number(quote.rate),
    });

    const lightning = await this.fedimintService.invoice(
      amountMsats,
      tx.reference,
    );

    const { status } = onramp
      ? await this.swapService.createOnrampSwap({
          quote: {
            id: quote.id,
            refreshIfExpired: false,
          },
          amountFiat: amountFiat.toString(),
          reference: tx.reference,
          source: onramp,
          target: {
            payout: lightning,
          },
        })
      : {
          status: TransactionStatus.PENDING,
        };

    this.logger.log(`Status: ${status}`);
    const deposit = await this.wallet.findOneAndUpdate(
      {
        _id: txId,
        userId,
      },
      {
        amountMsats,
        amountFiat,
        lightning: JSON.stringify(lightning),
        paymentTracker: lightning.operationId,
        status,
      },
    );

    // listen for payment
    this.fedimintService.receive(
      FedimintContext.SOLOWALLET_RECEIVE,
      lightning.operationId,
    );

    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination,
      priority: deposit._id,
    });

    const meta = await this.getWalletMeta(userId);

    return {
      txId: deposit._id,
      ledger,
      meta,
      userId,
    };
  }

  async userTransactions({
    userId,
    pagination,
  }: UserTxsRequestDto): Promise<UserTxsResponse> {
    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination,
    });
    const meta = await this.getWalletMeta(userId);

    // Record balance query metric
    this.solowalletMetricsService.recordBalanceMetric({
      userId,
      balanceMsats: meta.currentBalance,
      activity: 'query',
    });

    return {
      userId,
      ledger,
      meta,
    };
  }

  async findTransaction({
    txId,
    userId,
  }: FindTxRequestDto): Promise<SolowalletTx> {
    const filterQuery = { _id: txId };
    if (userId) {
      // If userId is provided, ensure we only return transactions owned by this user
      filterQuery['userId'] = userId;
    }
    const doc = await this.wallet.findOne(filterQuery);
    return toSolowalletTx(doc, this.logger);
  }

  async withdrawFunds({
    userId,
    amountFiat,
    reference,
    offramp,
    lightning,
    lnurlRequest,
    pagination,
    idempotencyKey,
    walletId,
    walletType,
  }: WithdrawFundsRequestDto & {
    walletId?: string;
    walletType?: WalletType;
  }): Promise<UserTxsResponse> {
    // Check for existing transaction with same idempotency key
    if (idempotencyKey) {
      try {
        const existing = await this.wallet.findOne({
          userId,
          type: TransactionType.WITHDRAW,
          idempotencyKey,
        });

        if (existing) {
          const ledger = await this.getPaginatedUserTxLedger({
            userId,
            pagination,
            priority: existing._id,
          });
          const meta = await this.getWalletMeta(userId);
          return {
            txId: existing._id,
            ledger,
            meta,
            userId,
          };
        }
      } catch {
        // Document not found, continue with new withdrawal
      }
    }

    const { currentBalance } = await this.getWalletMeta(userId);
    let withdrawal: SolowalletDocument;

    if (lightning) {
      // 1. Prefer lightning withdrawal where possible
      this.logger.log('Processing lightning invoice withdrawal');
      this.logger.log(lightning);

      // Decode the invoice to get the amount and details
      const inv = await this.fedimintService.decode(lightning.invoice);
      const invoiceMsats = Number(inv.amountMsats);

      this.logger.log(`Invoice amount: ${invoiceMsats} msats`);
      this.logger.log(`Current balance: ${currentBalance} msats`);

      // Check if user has enough balance to pay the invoice
      // Note: currentBalance already accounts for processing withdrawals
      if (invoiceMsats > currentBalance) {
        throw new Error(
          'Invoice amount exceeds available balance (including processing withdrawals)',
        );
      }

      try {
        // Pay the lightning invoice using fedimint
        const { operationId, fee } = await this.fedimintService.pay(
          lightning.invoice,
        );

        this.logger.log(
          `Lightning invoice paid successfully. Operation ID: ${operationId}, Fee: ${fee} msats`,
        );

        // Calculate total amount withdrawn (invoice amount + fee)
        const totalWithdrawnMsats = invoiceMsats + fee;

        // Create withdrawal record
        const now = new Date();

        withdrawal = await this.wallet.create({
          userId,
          amountMsats: totalWithdrawnMsats,
          amountFiat,
          lightning: JSON.stringify(lightning),
          paymentTracker: operationId,
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.COMPLETE,
          reference:
            reference ||
            inv.description ||
            `withdraw ${amountFiat} KES via Lightning`,
          idempotencyKey,
          stateChangedAt: now,
          timeoutAt: undefined, // Complete transactions don't need timeout
          retryCount: 0,
          maxRetries: 3,
          __v: 0,
          // Add wallet context for personal savings features (backward compatible)
          walletId: walletId || undefined,
          walletType: (walletType as WalletType) || WalletType.STANDARD,
        });

        this.logger.log(`Withdrawal record created with ID: ${withdrawal._id}`);
      } catch (error) {
        this.logger.error('Failed to pay lightning invoice', error);
        throw new Error(
          `Failed to process lightning payment: ${error.message}`,
        );
      }
    } else if (lnurlRequest) {
      // 2. Execute LNURL withdrawal flow
      this.logger.log('Creating LNURL withdrawal request');

      // Convert fiat amount to BTC msats for the withdrawal
      let maxWithdrawableMsats: number;

      if (amountFiat) {
        // Get the bitcoin amount from fiat if specified
        const quote = await this.swapService.getQuote({
          from: Currency.KES,
          to: Currency.BTC,
          amount: amountFiat.toString(),
        });
        const { amountMsats } = fiatToBtc({
          amountFiat: Number(amountFiat),
          btcToFiatRate: Number(quote.rate),
        });
        maxWithdrawableMsats = amountMsats;
      } else {
        // Otherwise use the current balance
        maxWithdrawableMsats = currentBalance;
      }

      this.logger.log(`Max withdrawable amount: ${maxWithdrawableMsats} msats`);
      this.logger.log(`Current balance: ${currentBalance} msats`);

      // Make sure we don't try to allow withdrawal more than the balance
      if (maxWithdrawableMsats > currentBalance) {
        maxWithdrawableMsats = currentBalance;
      }

      if (maxWithdrawableMsats <= 0) {
        throw new Error('Insufficient balance for withdrawal');
      }

      try {
        // Create the LNURL withdraw point code elements
        const lnurlWithdrawPoint =
          await this.fedimintService.createLnUrlWithdrawPoint(
            maxWithdrawableMsats,
            Math.min(1000, maxWithdrawableMsats), // Set reasonable minimum
            reference || 'Bitsacco Personal Savings Withdrawal',
          );

        this.logger.log(
          `LNURL withdrawal access point created. LNURL: ${lnurlWithdrawPoint.lnurl}`,
        );

        const fmLightning: FmLightning = {
          lnurlWithdrawPoint,
        };

        // Create a pending withdrawal record
        const now = new Date();
        const timeoutAt = this.timeoutConfigService.calculateTimeoutDate(
          TransactionStatus.PENDING,
          TimeoutTransactionType.LNURL_WITHDRAWAL,
        );

        withdrawal = await this.wallet.create({
          userId,
          amountMsats: maxWithdrawableMsats, // This will be updated when actually claimed
          amountFiat,
          lightning: JSON.stringify(fmLightning),
          paymentTracker: lnurlWithdrawPoint.k1, // We'll use k1 to track this withdrawal
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.PENDING, // Pending until someone scans and claims
          reference: reference || `withdraw ${amountFiat} KES via LNURL`,
          idempotencyKey,
          stateChangedAt: now,
          timeoutAt,
          retryCount: 0,
          maxRetries: 3,
          __v: 0,
          // Add wallet context for personal savings features (backward compatible)
          walletId: walletId || undefined,
          walletType: (walletType as WalletType) || WalletType.STANDARD,
        });

        this.logger.log(
          `LNURL withdrawal request recorded with ID: ${withdrawal._id}`,
        );
      } catch (error) {
        this.logger.error('Failed to create LNURL withdrawal request', error);
        throw new Error(
          `Failed to create LNURL withdrawal request: ${error.message}`,
        );
      }
    } else if (offramp) {
      // 3. Execute offramp withdrawals
      this.logger.log('Processing offramp withdrawal');

      // Get quote for conversion
      const quote = await this.swapService.getQuote({
        from: Currency.BTC,
        to: offramp.currency || Currency.KES,
        amount: amountFiat.toString(),
      });
      const { amountMsats } = fiatToBtc({
        amountFiat: Number(amountFiat),
        btcToFiatRate: Number(quote.rate),
      });

      // Check if user has enough balance
      // Note: currentBalance already accounts for processing withdrawals
      if (amountMsats > currentBalance) {
        throw new Error(
          'Insufficient funds for offramp withdrawal (including processing withdrawals)',
        );
      }

      // Initiate offramp swap
      const offrampSwap = await this.swapService.createOfframpSwap({
        quote: {
          id: quote.id,
          refreshIfExpired: false,
        },
        amountFiat: amountFiat.toString(),
        reference,
        target: offramp,
      });
      const status = offrampSwap.status;
      const invoice = offrampSwap.lightning;
      // Decode the lightning invoice to get the amount
      const invoiceData = await this.fedimintService.decode(invoice);
      const offrampMsats = parseInt(invoiceData.amountMsats);
      const swapTracker = offrampSwap.id;

      try {
        // Pay the invoice for the swap
        const { operationId, fee } = await this.fedimintService.pay(invoice);

        // Calculate total withdrawal amount including fee
        const totalOfframpMsats = offrampMsats + fee;

        // Create withdrawal record
        const now = new Date();
        const timeoutAt = this.timeoutConfigService.calculateTimeoutDate(
          TransactionStatus.PENDING,
          TimeoutTransactionType.OFFRAMP,
        );

        withdrawal = await this.wallet.create({
          userId,
          amountMsats: totalOfframpMsats,
          amountFiat,
          lightning: JSON.stringify({ invoice, operationId }),
          paymentTracker: swapTracker,
          type: TransactionType.WITHDRAW,
          status,
          reference: reference || `withdraw ${amountFiat} KES to mpesa`,
          idempotencyKey,
          stateChangedAt: now,
          timeoutAt:
            status === TransactionStatus.PENDING ? timeoutAt : undefined,
          retryCount: 0,
          maxRetries: 3,
          __v: 0,
          // Add wallet context for personal savings features (backward compatible)
          walletId: walletId || undefined,
          walletType: (walletType as WalletType) || WalletType.STANDARD,
        });

        this.logger.log(
          `Offramp withdrawal record created with ID: ${withdrawal._id}`,
        );
      } catch (error) {
        this.logger.error('Failed to process offramp payment', error);
        throw new Error(`Failed to process offramp payment: ${error.message}`);
      }
    } else {
      throw new Error(
        'No withdrawal method provided (lnurlRequest, lightning invoice, or offramp)',
      );
    }

    // Get updated transaction ledger
    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination,
      priority: withdrawal._id,
    });

    // Get updated wallet balance
    const meta = await this.getWalletMeta(userId);

    return {
      txId: withdrawal._id,
      ledger,
      meta,
      userId,
    };
  }

  async continueWithdrawFunds({
    userId,
    txId,
    amountFiat,
    reference,
    offramp,
    lightning,
    lnurlRequest,
    pagination,
  }: ContinueWithdrawFundsRequestDto): Promise<UserTxsResponse> {
    const tx = await this.wallet.findOne({ _id: txId });

    if (tx.userId !== userId) {
      throw new Error('Invalid request to continue transaction');
    }

    if (
      tx.status === TransactionStatus.PROCESSING ||
      tx.status === TransactionStatus.COMPLETE ||
      tx.status === TransactionStatus.FAILED
    ) {
      throw new Error('Transaction is processing or complete');
    }

    const { currentBalance } = await this.getWalletMeta(userId);
    let withdrawal: SolowalletDocument;

    if (lightning) {
      // 1. Prefer lightning withdrawal where possible
      this.logger.log('Processing lightning invoice withdrawal');
      this.logger.log(lightning);

      // Decode the invoice to get the amount and details
      const inv = await this.fedimintService.decode(lightning.invoice);
      const invoiceMsats = Number(inv.amountMsats);

      this.logger.log(`Invoice amount: ${invoiceMsats} msats`);
      this.logger.log(`Current balance: ${currentBalance} msats`);

      // Check if user has enough balance to pay the invoice
      // Note: currentBalance already accounts for processing withdrawals
      if (invoiceMsats > currentBalance) {
        throw new Error(
          'Invoice amount exceeds available balance (including processing withdrawals)',
        );
      }

      try {
        // Pay the lightning invoice using fedimint
        const { operationId, fee } = await this.fedimintService.pay(
          lightning.invoice,
        );

        this.logger.log(
          `Lightning invoice paid successfully. Operation ID: ${operationId}, Fee: ${fee} msats`,
        );

        // Calculate total amount withdrawn (invoice amount + fee)
        const totalWithdrawnMsats = invoiceMsats + fee;

        // Create withdrawal record
        withdrawal = await this.wallet.findOneAndUpdate(
          {
            _id: txId,
            userId,
          },
          {
            amountMsats: totalWithdrawnMsats,
            amountFiat,
            lightning: JSON.stringify({ ...lightning, operationId }),
            paymentTracker: operationId,
            type: TransactionType.WITHDRAW,
            status: TransactionStatus.COMPLETE,
            reference:
              reference ||
              inv.description ||
              `withdraw ${amountFiat} KES via Lightning`,
          },
        );

        this.logger.log(`Withdrawal record created with ID: ${withdrawal._id}`);
      } catch (error) {
        this.logger.error('Failed to pay lightning invoice', error);
        throw new Error(
          `Failed to process lightning payment: ${error.message}`,
        );
      }
    } else if (lnurlRequest) {
      // 2. Execute LNURL withdrawal flow
      this.logger.log('Creating LNURL withdrawal request');

      // Convert fiat amount to BTC msats for the withdrawal
      let maxWithdrawableMsats: number;

      if (amountFiat) {
        // Get the bitcoin amount from fiat if specified
        const quote = await this.swapService.getQuote({
          from: Currency.KES,
          to: Currency.BTC,
          amount: amountFiat.toString(),
        });
        const { amountMsats } = fiatToBtc({
          amountFiat: Number(amountFiat),
          btcToFiatRate: Number(quote.rate),
        });
        maxWithdrawableMsats = amountMsats;
      } else {
        // Otherwise use the current balance
        maxWithdrawableMsats = currentBalance;
      }

      this.logger.log(`Max withdrawable amount: ${maxWithdrawableMsats} msats`);
      this.logger.log(`Current balance: ${currentBalance} msats`);

      // Make sure we don't try to allow withdrawal more than the balance
      if (maxWithdrawableMsats > currentBalance) {
        maxWithdrawableMsats = currentBalance;
      }

      if (maxWithdrawableMsats <= 0) {
        throw new Error('Insufficient balance for withdrawal');
      }

      try {
        // Create the LNURL withdraw point code elements
        const lnurlWithdrawPoint =
          await this.fedimintService.createLnUrlWithdrawPoint(
            maxWithdrawableMsats,
            Math.min(1000, maxWithdrawableMsats), // Set reasonable minimum
            reference || 'Bitsacco Personal Savings Withdrawal',
          );

        this.logger.log(
          `LNURL withdrawal access point created. LNURL: ${lnurlWithdrawPoint.lnurl}`,
        );

        const fmLightning: FmLightning = {
          lnurlWithdrawPoint,
        };

        // Create a pending withdrawal record
        withdrawal = await this.wallet.findOneAndUpdate(
          {
            _id: txId,
            userId,
          },
          {
            amountMsats: maxWithdrawableMsats, // This will be updated when actually claimed
            amountFiat,
            lightning: JSON.stringify(fmLightning),
            paymentTracker: lnurlWithdrawPoint.k1,
            type: TransactionType.WITHDRAW,
            status: TransactionStatus.PENDING, // Pending until someone scans and claims
            reference: reference || `withdraw ${amountFiat} KES via LNURL`,
          },
        );

        this.logger.log(
          `LNURL withdrawal request recorded with ID: ${withdrawal._id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to create LNURL withdrawal request : ${error}`,
        );
        throw new Error(
          `Failed to create LNURL withdrawal request: ${error.message}`,
        );
      }
    } else if (offramp) {
      // 3. Execute offramp withdrawals
      this.logger.log('Processing offramp withdrawal');

      // Get quote for conversion
      const quote = await this.swapService.getQuote({
        from: Currency.BTC,
        to: offramp.currency || Currency.KES,
        amount: amountFiat.toString(),
      });
      const { amountMsats } = fiatToBtc({
        amountFiat: Number(amountFiat),
        btcToFiatRate: Number(quote.rate),
      });

      // Check if user has enough balance
      // Note: currentBalance already accounts for processing withdrawals
      if (amountMsats > currentBalance) {
        throw new Error(
          'Insufficient funds for offramp withdrawal (including processing withdrawals)',
        );
      }

      // Initiate offramp swap
      const offrampSwap = await this.swapService.createOfframpSwap({
        quote: {
          id: quote.id,
          refreshIfExpired: false,
        },
        amountFiat: amountFiat.toString(),
        reference,
        target: offramp,
      });
      const status = offrampSwap.status;
      const invoice = offrampSwap.lightning;
      // Decode the lightning invoice to get the amount
      const invoiceData = await this.fedimintService.decode(invoice);
      const offrampMsats = parseInt(invoiceData.amountMsats);
      const swapTracker = offrampSwap.id;

      try {
        // Pay the invoice for the swap
        const { operationId, fee } = await this.fedimintService.pay(invoice);

        // Calculate total withdrawal amount including fee
        const totalOfframpMsats = offrampMsats + fee;

        // Create withdrawal record
        withdrawal = await this.wallet.findOneAndUpdate(
          {
            _id: txId,
            userId,
          },
          {
            amountMsats: totalOfframpMsats,
            amountFiat,
            lightning: JSON.stringify({ invoice, operationId }),
            paymentTracker: swapTracker,
            type: TransactionType.WITHDRAW,
            status,
            reference: reference || `withdraw ${amountFiat} KES to mpesa`,
          },
        );

        this.logger.log(
          `Offramp withdrawal record created with ID: ${withdrawal._id}`,
        );
      } catch (error) {
        this.logger.error('Failed to process offramp payment', error);
        throw new Error(`Failed to process offramp payment: ${error.message}`);
      }
    } else {
      throw new Error(
        'No withdrawal method provided (lnurlRequest, lightning invoice, or offramp)',
      );
    }

    // Get updated transaction ledger
    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination,
      priority: withdrawal._id,
    });

    // Get updated wallet balance
    const meta = await this.getWalletMeta(userId);

    return {
      txId: withdrawal._id,
      ledger,
      meta,
      userId,
    };
  }

  async updateTransaction({ txId, updates, pagination }: UpdateTxDto) {
    const originTx = await this.wallet.findOne({ _id: txId });
    const { status, lightning, reference } = updates;

    // Validate state transition if status is being updated
    if (status !== undefined && status !== originTx.status) {
      validateStateTransition(
        originTx.status,
        status,
        SOLO_WALLET_STATE_TRANSITIONS,
        'solowallet transaction',
      );
    }

    const { userId } = await this.wallet.findOneAndUpdate(
      { _id: txId },
      {
        status: status !== undefined ? status : originTx.status,
        lightning: lightning !== undefined ? lightning : originTx.lightning,
        reference: reference ?? originTx.reference,
      },
    );

    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination,
      priority: originTx._id,
    });
    const meta = await this.getWalletMeta(userId);

    return {
      txId: originTx._id,
      ledger,
      meta,
      userId,
    };
  }

  @OnEvent(fedimint_receive_success)
  private async handleSuccessfulReceive({
    context,
    operationId,
  }: FedimintReceiveSuccessEvent) {
    // Only handle solowallet context
    if (context !== FedimintContext.SOLOWALLET_RECEIVE) {
      return;
    }

    await this.wallet.findOneAndUpdate(
      { paymentTracker: operationId },
      {
        status: TransactionStatus.COMPLETE,
      },
    );

    this.logger.log(
      `Received lightning payment for ${context} : ${operationId}`,
    );
  }

  @OnEvent(fedimint_receive_failure)
  private async handleFailedReceive({
    context,
    operationId,
  }: FedimintReceiveFailureEvent) {
    // Only handle solowallet context
    if (context !== FedimintContext.SOLOWALLET_RECEIVE) {
      return;
    }

    this.logger.log(
      `Failed to receive lightning payment for ${context} : ${operationId}`,
    );

    await this.wallet.findOneAndUpdate(
      { paymentTracker: operationId },
      {
        status: TransactionStatus.FAILED, // Changed from 'state' to 'status' to fix bug
      },
    );
  }

  @OnEvent(swap_status_change)
  async handleSwapStatusChange({
    context,
    payload,
    error,
  }: SwapStatusChangeEvent) {
    this.logger.log(
      `Received swap status change - context: ${context} - refundable : ${payload.refundable}`,
    );

    if (error) {
      this.logger.error(`Swap status change has error: ${error}`);
    }

    try {
      const { swapTracker, swapStatus } = payload;
      const txd = await this.wallet.findOneAndUpdate(
        { paymentTracker: swapTracker },
        {
          status: swapStatus,
        },
      );

      this.logger.log(
        `Updated solowallet transaction ${txd._id} to status: ${swapStatus}`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating solowallet transaction for swap: ${payload.swapTracker}`,
        error,
      );
    }
  }
}
