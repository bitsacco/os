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
      .map(toSolowalletTx);

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
    return toSolowalletTx(doc);
  }

  async withdrawFunds({
    userId,
    amountFiat,
    reference,
    offramp,
    lightning,
    pagination,
  }: WithdrawFundsRequestDto): Promise<UserTxsResponse> {
    const { quote, amountMsats } = await getQuote(
      {
        from: Currency.BTC,
        to: offramp?.currency || Currency.KES,
        amount: amountFiat.toString(),
      },
      this.swapService,
      this.logger,
    );

    const { currentBalance } = await this.getWalletMeta(userId);
    if (amountMsats > currentBalance) {
      throw new Error('Insufficient funds');
    }

    let withdrawal: SolowalletDocument;

    if (lightning) {
      this.logger.log(lightning);
      const inv = await this.fedimintService.decode(lightning.invoice);
      const invoiceMsats = Number(inv.amountMsats);

      if (invoiceMsats > amountMsats || invoiceMsats > currentBalance) {
        throw new Error(
          'Invoice amount exceeds withdrawal amount or available balance',
        );
      }

      const { operationId, fee } = await this.fedimintService.pay(
        lightning.invoice,
      );
      this.logger.log('paid invoice');
      this.logger.log(operationId);

      withdrawal = await this.wallet.create({
        userId,
        // TODO: https://github.com/bitsacco/os/issues/78
        amountMsats: invoiceMsats + fee,
        amountFiat,
        lightning: JSON.stringify(lightning),
        paymentTracker: operationId,
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.COMPLETE,
        reference,
      });
    } else if (offramp) {
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

      const { operationId, fee } = await this.fedimintService.pay(invoice);
      withdrawal = await this.wallet.create({
        userId,
        // TODO: https://github.com/bitsacco/os/issues/78
        amountMsats: offrampMsats * fee,
        amountFiat,
        lightning: JSON.stringify({ invoice }),
        paymentTracker: operationId,
        type: TransactionType.WITHDRAW,
        status,
        reference,
      });
    } else {
      throw new Error('No offramp or lightning withdrawal path provided');
    }

    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination,
      priority: withdrawal._id,
    });
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
}
