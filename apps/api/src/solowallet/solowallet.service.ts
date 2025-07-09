import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Currency,
  DepositFundsRequestDto,
  WalletMeta,
  fedimint_receive_failure,
  fedimint_receive_success,
  swap_status_change,
  FedimintService,
  LnurlMetricsService,
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
  parseTransactionStatus,
  ContinueDepositFundsRequestDto,
  ContinueWithdrawFundsRequestDto,
  fiatToBtc,
} from '@bitsacco/common';
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
    private readonly lnurlMetricsService: LnurlMetricsService,
    private readonly solowalletMetricsService: SolowalletMetricsService,
    private readonly swapService: SwapService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('SolowalletService created');

    // Initialize FedimintService
    this.fedimintService.initialize(
      this.configService.get<string>('SOLOWALLET_CLIENTD_BASE_URL'),
      this.configService.get<string>('SOLOWALLET_FEDERATION_ID'),
      this.configService.get<string>('SOLOWALLET_GATEWAY_ID'),
      this.configService.get<string>('SOLOWALLET_CLIENTD_PASSWORD'),
      this.configService.get<string>('SOLOWALLET_LNURL_CALLBACK'),
    );

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

  private async aggregateUserTransactions(
    userId: string,
    type: TransactionType,
  ): Promise<number> {
    let transactions: number = 0;
    try {
      transactions = await this.wallet
        .aggregate([
          {
            $match: {
              userId: userId,
              status: TransactionStatus.COMPLETE.toString(),
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
          return result[0].totalMsats || 0;
        });
    } catch (e) {
      this.logger.error('Error aggregating transactions', e);
    }

    return transactions;
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

    return {
      totalDeposits,
      totalWithdrawals,
      currentBalance: totalDeposits - totalWithdrawals,
    };
  }

  async depositFunds({
    userId,
    amountFiat,
    reference,
    onramp,
    pagination,
  }: DepositFundsRequestDto): Promise<UserTxsResponse> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      const quote = await this.swapService.getQuote({
        from: onramp?.currency || Currency.KES,
        to: Currency.BTC,
        amount: amountFiat.toString(),
      });

      const { amountMsats } = fiatToBtc({
        amountFiat: Number(amountFiat),
        btcToFiatRate: Number(quote.rate),
      });

      this.logger.log(
        `Quote rate: ${quote.rate}, amountFiat: ${amountFiat}, calculated amountMsats: ${amountMsats}`,
      );

      const lightning = await this.fedimintService.invoice(
        amountMsats,
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
          amountFiat: amountFiat.toString(),
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
      const deposit = await this.wallet.create({
        userId,
        amountMsats,
        amountFiat,
        lightning: JSON.stringify(lightning),
        paymentTracker,
        type: TransactionType.DEPOSIT,
        status,
        reference,
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
      success = true;

      // Record metrics for this operation
      this.solowalletMetricsService.recordDepositMetric({
        userId,
        amountMsats,
        amountFiat,
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
  }: WithdrawFundsRequestDto): Promise<UserTxsResponse> {
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
      if (invoiceMsats > currentBalance) {
        throw new Error('Invoice amount exceeds available balance');
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
        withdrawal = await this.wallet.create({
          userId,
          amountMsats: maxWithdrawableMsats, // This will be updated when actually claimed
          amountFiat,
          lightning: JSON.stringify(fmLightning),
          paymentTracker: lnurlWithdrawPoint.k1, // We'll use k1 to track this withdrawal
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.PENDING, // Pending until someone scans and claims
          reference: reference || `withdraw ${amountFiat} KES via LNURL`,
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
      if (amountMsats > currentBalance) {
        throw new Error('Insufficient funds for offramp withdrawal');
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
        withdrawal = await this.wallet.create({
          userId,
          amountMsats: totalOfframpMsats,
          amountFiat,
          lightning: JSON.stringify({ invoice, operationId }),
          paymentTracker: swapTracker,
          type: TransactionType.WITHDRAW,
          status,
          reference: reference || `withdraw ${amountFiat} KES to mpesa`,
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
      if (invoiceMsats > currentBalance) {
        throw new Error('Invoice amount exceeds available balance');
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
      if (amountMsats > currentBalance) {
        throw new Error('Insufficient funds for offramp withdrawal');
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

  /**
   * Find a pending LNURL withdrawal transaction by k1 value
   * @param k1 The k1 identifier from the LNURL withdrawal request
   * @returns The transaction document if found, null otherwise
   */
  async findPendingLnurlWithdrawal(k1: string): Promise<SolowalletTx | null> {
    this.logger.log(`Looking for pending withdrawal with k1: ${k1}`);

    try {
      // Find transaction by paymentTracker (which stores the k1 value)
      const doc = await this.wallet.findOne({
        paymentTracker: k1,
        type: TransactionType.WITHDRAW.toString(),
      });

      if (!doc) {
        this.logger.log(`No withdrawal found with k1: ${k1}`);
        return null;
      }

      const status = parseTransactionStatus<TransactionStatus>(
        doc.status.toString(),
        TransactionStatus.UNRECOGNIZED,
        this.logger,
      );

      this.logger.log(`TRANSACTION STATUS: ${status}`);
      if (status !== TransactionStatus.PENDING) {
        throw new Error('Transaction is not pending');
      }

      return toSolowalletTx(doc, this.logger);
    } catch (error) {
      this.logger.error(
        `Error finding pending withdrawal: ${error.message}`,
        error,
      );
      return null;
    }
  }

  /**
   * Handle an LNURL withdraw callback when a user scans the QR code
   */
  async processLnUrlWithdrawCallback(
    k1: string,
    pr: string,
  ): Promise<{ success: boolean; message: string; txId?: string }> {
    this.logger.log(`Processing LNURL withdraw callback with k1: ${k1}`);

    // Start timing the operation for metrics
    const startTime = Date.now();

    try {
      // 1. Find the pending withdrawal record using the k1 value
      const withdrawal = await this.wallet.findOne({
        paymentTracker: k1,
        status: TransactionStatus.PENDING,
        type: TransactionType.WITHDRAW,
      });

      if (!withdrawal) {
        throw new Error('Withdrawal request not found or already processed');
      }

      // 2. Check if the withdrawal request has expired
      const lightningData = JSON.parse(withdrawal.lightning);
      if (
        lightningData.expiresAt &&
        Date.now() / 1000 > lightningData.expiresAt
      ) {
        throw new Error('Withdrawal request has expired');
      }

      // 3. Decode the invoice to get the amount
      const invoiceDetails = await this.fedimintService.decode(pr);

      // 4. Pay the invoice directly
      const { operationId, fee } = await this.fedimintService.pay(pr);

      // TODO: Issue #78 - https://github.com/bitsacco/os/issues/78
      // final amount charged: = actual withdrawn amount plus fee paid
      const amountMsats = Number(invoiceDetails.amountMsats) + fee;

      // 5. Update the withdrawal record
      const updatedWithdrawal = await this.wallet.findOneAndUpdate(
        { _id: withdrawal._id },
        {
          status: TransactionStatus.COMPLETE,
          amountMsats: amountMsats,
          updatedAt: new Date(),
          lightning: JSON.stringify({
            invoice: pr,
            operationId,
          }),
        },
      );

      this.logger.log(
        `LNURL withdrawal successfully completed for ID: ${updatedWithdrawal._id}`,
      );

      // Get the updated balance for this user
      const { currentBalance } = await this.getWalletMeta(withdrawal.userId);

      // Record metrics via both services
      const duration = Date.now() - startTime;

      // Legacy LNURL metrics
      this.lnurlMetricsService.recordWithdrawalMetric({
        success: true,
        duration,
        amountMsats: updatedWithdrawal.amountMsats,
        amountFiat: updatedWithdrawal.amountFiat,
        paymentHash: invoiceDetails.paymentHash,
        userId: withdrawal.userId,
        wallet: 'solowallet',
      });

      // New standardized solowallet metrics
      this.solowalletMetricsService.recordWithdrawalMetric({
        userId: withdrawal.userId,
        amountMsats: updatedWithdrawal.amountMsats,
        amountFiat: updatedWithdrawal.amountFiat,
        method: 'lnurl',
        success: true,
        duration,
      });

      // Also record the new balance
      this.solowalletMetricsService.recordBalanceMetric({
        userId: withdrawal.userId,
        balanceMsats: currentBalance,
        activity: 'withdrawal',
      });

      return {
        success: true,
        message: 'Withdrawal successful',
        txId: updatedWithdrawal._id,
      };
    } catch (error) {
      this.logger.error('Failed to process LNURL withdraw callback', error);

      // Record failed metrics via both services
      const duration = Date.now() - startTime;

      // Legacy LNURL metrics
      this.lnurlMetricsService.recordWithdrawalMetric({
        success: false,
        duration,
        errorType: error.message || 'Unknown error',
      });

      // New standardized solowallet metrics
      this.solowalletMetricsService.recordWithdrawalMetric({
        userId: 'unknown', // User ID not available in error state
        amountMsats: 0,
        method: 'lnurl',
        success: false,
        duration,
        errorType: error.message || 'Unknown error',
      });

      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Check the status of an LNURL withdrawal request
   * @param withdrawId The ID of the withdrawal
   * @returns The withdrawal transaction details
   */
  async checkLnUrlWithdrawStatus(withdrawId: string): Promise<SolowalletTx> {
    this.logger.log(`Checking status of LNURL withdrawal: ${withdrawId}`);

    const doc = await this.wallet.findOne({ _id: withdrawId });

    if (!doc) {
      throw new Error('Withdrawal request not found');
    }

    return toSolowalletTx(doc, this.logger);
  }
}
