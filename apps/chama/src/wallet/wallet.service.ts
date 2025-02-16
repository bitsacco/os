import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import {
  ChamaContinueDepositDto,
  ChamaContinueWithdrawDto,
  ChamaDepositDto,
  ChamaTxStatus,
  ChamaWithdrawDto,
  Currency,
  default_page,
  default_page_size,
  fedimint_receive_failure,
  fedimint_receive_success,
  FedimintService,
  FilterChamaTransactionsDto,
  FindTxRequestDto,
  getQuote,
  initiateOnrampSwap,
  PaginatedChamaTxsResponse,
  ReceiveContext,
  SWAP_SERVICE_NAME,
  SwapServiceClient,
  TransactionStatus,
  TransactionType,
  UpdateChamaTransactionDto,
  type ChamaTxGroupMeta,
  type ChamaTxMemberMeta,
  type ReceivePaymentFailureEvent,
  type ReceivePaymentSuccessEvent,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ChamaWalletRepository, toChamaWalletTx } from './db';

@Injectable()
export class ChamaWalletService {
  private readonly logger = new Logger(ChamaWalletService.name);
  private readonly swapService: SwapServiceClient;

  constructor(
    private readonly wallet: ChamaWalletRepository,
    private readonly fedimintService: FedimintService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(SWAP_SERVICE_NAME) private readonly swapGrpc: ClientGrpc,
  ) {
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
    this.logger.debug('ChamaWalletService initialized');
  }

  async deposit({
    memberId,
    chamaId,
    amountFiat,
    reference,
    onramp,
    pagination,
  }: ChamaDepositDto) {
    // TODO: Validate member and chama exist

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
      ? await initiateOnrampSwap<ChamaTxStatus>(
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
          status: ChamaTxStatus.PENDING,
        };

    this.logger.log(`Status: ${status}`);
    const deposit = await this.wallet.create({
      memberId,
      chamaId,
      amountMsats,
      amountFiat,
      lightning: JSON.stringify(lightning),
      paymentTracker: lightning.operationId,
      type: TransactionType.DEPOSIT,
      status,
      reviews: [],
      reference,
    });

    // listen for payment
    this.fedimintService.receive(
      ReceiveContext.CHAMAWALLET,
      lightning.operationId,
    );

    const ledger = await this.getPaginatedChamaTransactions({
      memberId,
      chamaId,
      pagination,
      priority: deposit._id,
    });

    const { groupMeta, memberMeta } = await this.getWalletMeta(
      chamaId,
      memberId,
    );

    return {
      txId: deposit._id,
      ledger,
      groupMeta,
      memberMeta,
    };
  }

  async continueDeposit({
    txId,
    amountFiat,
    reference,
    onramp,
    pagination,
  }: ChamaContinueDepositDto) {
    const txd = await this.wallet.findOne({ _id: txId });

    if (
      txd.status === ChamaTxStatus.COMPLETE ||
      txd.status === ChamaTxStatus.PROCESSING
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
      txd.reference,
    );

    const { status } = onramp
      ? await initiateOnrampSwap(
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
    const deposit = await this.wallet.findOneAndUpdate(
      {
        _id: txId,
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

    const ledger = await this.getPaginatedChamaTransactions({
      memberId: txd.memberId,
      chamaId: txd.chamaId,
      pagination,
      priority: deposit._id,
    });

    const { groupMeta, memberMeta } = await this.getWalletMeta(
      txd.memberId,
      txd.chamaId,
    );

    return {
      txId: deposit._id,
      ledger,
      groupMeta,
      memberMeta,
    };
  }

  withdraw(request: ChamaWithdrawDto) {
    throw new NotImplementedException('withdrawFunds method not implemented');
  }

  continueWithdraw(request: ChamaContinueWithdrawDto) {
    throw new NotImplementedException(
      'continueWithdraw method not implemented',
    );
  }

  async updateTransaction({
    txId,
    updates,
    pagination,
  }: UpdateChamaTransactionDto) {
    const txd = await this.wallet.findOne({ _id: txId });
    const { status, amountMsats, reviews, reference } = updates;

    await this.wallet.findOneAndUpdate(
      { _id: txId },
      {
        status: status !== undefined ? status : txd.status,
        amountMsats: amountMsats !== undefined ? amountMsats : txd.amountMsats,
        reviews: reviews !== undefined ? reviews : txd.reviews,
        reference: reference ?? txd.reference,
      },
    );

    const ledger = await this.getPaginatedChamaTransactions({
      memberId: txd.memberId,
      chamaId: txd.chamaId,
      pagination,
      priority: txId,
    });

    const { groupMeta, memberMeta } = await this.getWalletMeta(
      txd.memberId,
      txd.chamaId,
    );

    return {
      txId,
      ledger,
      groupMeta,
      memberMeta,
    };
  }

  async findTransaction({ txId }: FindTxRequestDto) {
    try {
      const txd = await this.wallet.findOne({ _id: txId });
      return toChamaWalletTx(txd);
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  async filterTransactions(request: FilterChamaTransactionsDto) {
    try {
      return this.getPaginatedChamaTransactions(request);
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  private async getPaginatedChamaTransactions({
    memberId,
    chamaId,
    pagination,
    priority,
  }: FilterChamaTransactionsDto & {
    priority?: string;
  }): Promise<PaginatedChamaTxsResponse> {
    const filter: ChamaTxFilter = {};

    if (memberId) {
      filter.memberId = memberId;
    }

    if (chamaId) {
      filter.chamaId = chamaId;
    }

    let allTxds = await this.wallet.find(filter, { createdAt: -1 });

    if (priority) {
      const priorityTx = allTxds.find((tx) => tx._id.toString() === priority);
      if (!priorityTx) {
        throw new NotFoundException(
          `Transaction with id ${priority} not found`,
        );
      }

      allTxds = [
        priorityTx,
        ...allTxds.filter((tx) => tx._id.toString() !== priority),
      ];
    }

    const { page, size } = pagination || {
      page: default_page,
      size: default_page_size,
    };
    const pages = Math.ceil(allTxds.length / size);

    // select the last page if requested page exceeds total pages possible
    const selectPage = page > pages ? pages - 1 : page;

    const transactions = allTxds
      .slice(selectPage * size, (selectPage + 1) * size)
      .map(toChamaWalletTx);

    return {
      transactions,
      page: selectPage,
      size,
      pages,
    };
  }

  private async aggregateTransactions(
    type: TransactionType,
    chamaId?: string,
    memberId?: string,
  ): Promise<number> {
    let transactions: number = 0;
    const filter: ChamaTxFilter & {
      status: ChamaTxStatus.COMPLETE;
      type: TransactionType;
    } = {
      status: ChamaTxStatus.COMPLETE,
      type: type,
    };

    if (memberId) {
      filter.memberId = memberId;
    }

    if (chamaId) {
      filter.chamaId = chamaId;
    }

    try {
      transactions = await this.wallet
        .aggregate([
          {
            $match: filter,
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

  private async getWalletMeta(
    chamaId?: string,
    memberId?: string,
  ): Promise<{
    groupMeta: ChamaTxGroupMeta;
    memberMeta: ChamaTxMemberMeta;
  }> {
    const groupDeposits = await this.aggregateTransactions(
      TransactionType.DEPOSIT,
    );
    const groupWithdrawals = await this.aggregateTransactions(
      TransactionType.WITHDRAW,
    );

    const groupMeta = {
      groupDeposits,
      groupWithdrawals,
      currentBalance: groupDeposits - groupWithdrawals,
    };

    const memberDeposits = await this.aggregateTransactions(
      TransactionType.DEPOSIT,
    );
    const memberWithdrawals = await this.aggregateTransactions(
      TransactionType.WITHDRAW,
    );

    const memberMeta = {
      memberDeposits,
      memberWithdrawals,
      currentBalance: memberDeposits - memberWithdrawals,
    };

    return {
      groupMeta,
      memberMeta,
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

interface ChamaTxFilter {
  memberId?: string;
  chamaId?: string;
}
