import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Currency,
  DepositFundsRequestDto,
  WalletMeta,
  fedimint_receive_failure,
  fedimint_receive_success,
  FedimintService,
  UserTxsResponse,
  UserTxsRequestDto,
  PaginatedSolowalletTxsResponse,
  ReceiveContext,
  type ReceivePaymentFailureEvent,
  type ReceivePaymentSuccessEvent,
  SWAP_SERVICE_NAME,
  SwapServiceClient,
  TransactionStatus,
  TransactionType,
  WithdrawFundsRequestDto,
  UpdateTxDto,
  ContinueTxRequestDto,
  default_page,
  default_page_size,
  SolowalletTx,
  FindTxRequestDto,
  getQuote,
  initiateOfframpSwap,
  initiateOnrampSwap,
  FmLightning,
  parseTransactionStatus,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SolowalletDocument, SolowalletRepository, toSolowalletTx } from './db';

@Injectable()
export class SolowalletService {
  private readonly logger = new Logger(SolowalletService.name);
  private readonly swapService: SwapServiceClient;

  constructor(
    private readonly wallet: SolowalletRepository,
    private readonly fedimintService: FedimintService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(SWAP_SERVICE_NAME) private readonly swapGrpc: ClientGrpc,
  ) {
    this.logger.log('SolowalletService created');
    this.swapService =
      this.swapGrpc.getService<SwapServiceClient>(SWAP_SERVICE_NAME);

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
    const { quote, amountMsats } = await getQuote(
      {
        from: onramp?.currency || Currency.KES,
        to: Currency.BTC,
        amount: amountFiat.toString(),
      },
      this.swapService,
      this.logger,
    );

    const lightning = await this.fedimintService.invoice(
      amountMsats,
      reference,
    );

    const { status } = onramp
      ? await initiateOnrampSwap<TransactionStatus>(
          {
            quote,
            amountFiat: amountFiat.toString(),
            reference,
            source: onramp,
            target: {
              payout: lightning,
            },
          },
          this.swapService,
          this.logger,
        )
      : {
          status: TransactionStatus.PENDING,
        };

    this.logger.log(`Status: ${status}`);
    const deposit = await this.wallet.create({
      userId,
      amountMsats,
      amountFiat,
      lightning: JSON.stringify(lightning),
      paymentTracker: lightning.operationId,
      type: TransactionType.DEPOSIT,
      status,
      reference,
    });

    // listen for payment
    this.fedimintService.receive(
      ReceiveContext.SOLOWALLET,
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

    return {
      userId,
      ledger,
      meta,
    };
  }

  async findTransaction({ txId }: FindTxRequestDto): Promise<SolowalletTx> {
    const doc = await this.wallet.findOne({ _id: txId });
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
          reference: reference || inv.description || 'Lightning withdrawal',
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
        const { amountMsats } = await getQuote(
          {
            from: Currency.KES,
            to: Currency.BTC,
            amount: amountFiat.toString(),
          },
          this.swapService,
          this.logger,
        );
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
            reference || 'Bitsacco Withdrawal',
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
          reference: reference || 'LNURL Withdrawal',
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
      const { quote, amountMsats } = await getQuote(
        {
          from: Currency.BTC,
          to: offramp.currency || Currency.KES,
          amount: amountFiat.toString(),
        },
        this.swapService,
        this.logger,
      );

      // Check if user has enough balance
      if (amountMsats > currentBalance) {
        throw new Error('Insufficient funds for offramp withdrawal');
      }

      // Initiate offramp swap
      const {
        status,
        amountMsats: offrampMsats,
        invoice,
      } = await initiateOfframpSwap<TransactionStatus>(
        {
          quote,
          amountFiat: amountFiat.toString(),
          reference,
          target: offramp,
        },
        this.swapService,
        this.logger,
      );

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
          lightning: JSON.stringify({ invoice }),
          paymentTracker: operationId,
          type: TransactionType.WITHDRAW,
          status,
          reference: reference || 'Offramp withdrawal',
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

  async continueTransaction({
    userId,
    txId,
    amountFiat,
    onramp,
    pagination,
  }: ContinueTxRequestDto): Promise<UserTxsResponse> {
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

    const { quote, amountMsats } = await getQuote(
      {
        from: onramp?.currency || Currency.KES,
        to: Currency.BTC,
        amount: amountFiat.toString(),
      },
      this.swapService,
      this.logger,
    );

    const lightning = await this.fedimintService.invoice(
      amountMsats,
      tx.reference,
    );

    const { status } = onramp
      ? await initiateOnrampSwap(
          {
            quote,
            amountFiat: amountFiat.toString(),
            reference: tx.reference,
            source: onramp,
            target: {
              payout: lightning,
            },
          },
          this.swapService,
          this.logger,
        )
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
      ReceiveContext.SOLOWALLET,
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

  @OnEvent(fedimint_receive_success)
  private async handleSuccessfulReceive({
    context,
    operationId,
  }: ReceivePaymentSuccessEvent) {
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
  }: ReceivePaymentFailureEvent) {
    this.logger.log(
      `Failed to receive lightning payment for ${context} : ${operationId}`,
    );

    await this.wallet.findOneAndUpdate(
      { paymentTracker: operationId },
      {
        state: TransactionStatus.FAILED,
      },
    );
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
        await this.wallet.findOneAndUpdate(
          { _id: withdrawal._id },
          { status: TransactionStatus.FAILED },
        );
        throw new Error('Withdrawal request has expired');
      }

      // 3. Decode the invoice to get the amount
      const invoiceDetails = await this.fedimintService.decode(pr);
      const amountMsats = Number(invoiceDetails.amountMsats);

      // 4. Pay the invoice directly
      const { operationId, fee } = await this.fedimintService.pay(pr);

      // 5. Update the withdrawal record
      const updatedWithdrawal = await this.wallet.findOneAndUpdate(
        { _id: withdrawal._id },
        {
          status: TransactionStatus.COMPLETE,
          amountMsats: amountMsats + fee, // Update to the actual withdrawn amount plus fee
          updatedAt: new Date(),
          // Store the payment info for reference
          lightning: JSON.stringify({
            ...lightningData,
            operationId,
            pr,
            amountMsats,
            fee,
          }),
        },
      );

      this.logger.log(
        `LNURL withdrawal successfully completed for ID: ${updatedWithdrawal._id}`,
      );

      return {
        success: true,
        message: 'Withdrawal successful',
        txId: updatedWithdrawal._id,
      };
    } catch (error) {
      this.logger.error('Failed to process LNURL withdraw callback', error);
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
