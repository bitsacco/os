import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import {
  AggregateChamaTransactionsDto,
  ChamaContinueDepositDto,
  ChamaContinueWithdrawDto,
  ChamaDepositDto,
  ChamaMemberRole,
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
  Review,
  SWAP_SERVICE_NAME,
  SwapServiceClient,
  TransactionStatus,
  TransactionType,
  UpdateChamaTransactionDto,
  UsersService,
  type ChamaMeta,
  type MemberMeta,
  type ChamaTxGroupMeta,
  type ChamaTxMemberMeta,
  type ReceivePaymentFailureEvent,
  type ReceivePaymentSuccessEvent,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ChamaMessageService } from '../chamas/chamas.messaging';
import { ChamasService } from '../chamas/chamas.service';
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
    private readonly chamas: ChamasService,
    private readonly users: UsersService,
    private readonly messenger: ChamaMessageService,
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

  async requestWithdraw({
    memberId,
    chamaId,
    amountFiat,
    reference,
    pagination,
  }: ChamaWithdrawDto) {
    const { memberMeta, groupMeta } = await this.getWalletMeta(
      chamaId,
      memberId,
    );

    const chama = await this.chamas.findChama({ chamaId });
    const initiatorMember = chama.members.find(
      (member) => member.userId === memberId,
    );
    const isAdmin =
      initiatorMember?.roles.includes(ChamaMemberRole.Admin) ||
      initiatorMember?.roles.includes(ChamaMemberRole.ExternalAdmin);

    const initialReviews = [];

    // If member is an admin, add their pre-approval
    if (isAdmin) {
      this.logger.log(
        `Member ${memberId} is a chama admin - adding pre-approval to withdrawal`,
      );
      initialReviews.push({
        memberId,
        review: Review.APPROVE,
      });
    }

    const { amountMsats } = await getQuote(
      {
        from: Currency.KES,
        to: Currency.BTC,
        amount: amountFiat.toString(),
      },
      this.swapService,
      this.logger,
    );

    // Create a pending withdrawal record that requires approval
    const withdrawal = toChamaWalletTx(
      await this.wallet.create({
        memberId,
        chamaId,
        amountMsats,
        amountFiat,
        lightning: JSON.stringify({}),
        paymentTracker: `${Date.now()}`,
        type: TransactionType.WITHDRAW,
        status:
          isAdmin && initialReviews.length > 0
            ? ChamaTxStatus.APPROVED // Auto-approve if sole admin
            : ChamaTxStatus.PENDING,
        reviews: initialReviews, // Include self-approval if admin
        reference: reference || 'Offramp withdrawal (pending approval)',
      }),
      this.logger,
    );

    if (withdrawal.status === ChamaTxStatus.PENDING) {
      // Send notifications to other admins asynchronously (don't wait for completion)
      try {
        // Find all admin members excluding the initiator
        const adminMemberIds = chama.members
          .filter(
            (member) =>
              (member.roles.includes(ChamaMemberRole.Admin) ||
                member.roles.includes(ChamaMemberRole.ExternalAdmin)) &&
              member.userId !== memberId,
          )
          .map((member) => member.userId);

        if (adminMemberIds.length === 0) {
          this.logger.log('No other admins to notify about the withdrawal');
        }

        const admins = await this.users.findUsersById(new Set(adminMemberIds));

        this.messenger.sendChamaWithdrawalApprovalLink(
          chama,
          admins,
          withdrawal,
        );
      } catch (e) {
        this.logger.error(e);
      }
    }

    // Get updated transaction ledger
    const ledger = await this.getPaginatedChamaTransactions({
      memberId,
      chamaId,
      pagination,
      priority: withdrawal.id,
    });

    // Return the updated wallet information
    return {
      txId: withdrawal.id,
      ledger,
      groupMeta,
      memberMeta,
    };
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
      return toChamaWalletTx(txd, this.logger);
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

    let { page, size } = pagination || {
      page: default_page,
      size: default_page_size,
    };

    // if size is set to 0, we should return all available data in a single page
    size = size || allTxds.length;

    const pages = Math.ceil(allTxds.length / size);

    // select the last page if requested page exceeds total pages possible
    const selectPage = page > pages ? pages - 1 : page;

    const transactions = allTxds
      .slice(selectPage * size, (selectPage + 1) * size)
      .map((txd) => toChamaWalletTx(txd, this.logger));

    return {
      transactions,
      page: selectPage,
      size,
      pages,
    };
  }

  async aggregateWalletMeta({
    selectChamaId,
    selectMemberId,
    skipMemberMeta,
  }: AggregateChamaTransactionsDto) {
    const chamaIds = selectChamaId?.length
      ? selectChamaId
      : (
          await this.chamas.filterChamas({
            pagination: {
              page: 0,
              size: 0, // flag to all chama data in a single page
            },
          })
        ).chamas.map((chama) => chama.id);

    const meta: ChamaMeta[] = await Promise.all(
      chamaIds.map(async (chamaId) => {
        const groupMeta: ChamaTxGroupMeta =
          await this.getGroupWalletMeta(chamaId);

        let memberIds = skipMemberMeta ? [] : selectMemberId;
        if (!selectMemberId?.length && !skipMemberMeta) {
          try {
            memberIds = (await this.chamas.findChama({ chamaId })).members.map(
              (member) => member.userId,
            );
          } catch (e) {
            this.logger.error(`Chama with id ${chamaId} not found`);
            memberIds = [];
          }
        }

        const memberMeta: MemberMeta[] = await Promise.all(
          memberIds.map(async (memberId) => {
            const memberMeta = await this.getMemberWalletMeta(
              chamaId,
              memberId,
            );
            return {
              memberId,
              memberMeta,
            };
          }),
        );

        return {
          chamaId,
          groupMeta,
          memberMeta,
        };
      }),
    );

    return {
      meta,
    };
  }

  private async getWalletMeta(
    chamaId?: string,
    memberId?: string,
  ): Promise<{
    groupMeta: ChamaTxGroupMeta;
    memberMeta: ChamaTxMemberMeta;
  }> {
    const groupMeta = await this.getGroupWalletMeta(chamaId);
    const memberMeta = await this.getMemberWalletMeta(chamaId, memberId);
    return {
      groupMeta,
      memberMeta,
    };
  }

  private async getGroupWalletMeta(
    chamaId?: string,
  ): Promise<ChamaTxGroupMeta> {
    try {
      const groupDeposits = await this.aggregateTransactions(
        TransactionType.DEPOSIT,
        chamaId,
      );
      const groupWithdrawals = await this.aggregateTransactions(
        TransactionType.WITHDRAW,
        chamaId,
      );

      const groupBalance = groupDeposits - groupWithdrawals;

      return {
        groupDeposits,
        groupWithdrawals,
        groupBalance,
      };
    } catch (e) {
      this.logger.error(e);
      return {
        groupDeposits: 0,
        groupWithdrawals: 0,
        groupBalance: 0,
      };
    }
  }

  private async getMemberWalletMeta(
    chamaId?: string,
    memberId?: string,
  ): Promise<ChamaTxMemberMeta> {
    try {
      const memberDeposits = await this.aggregateTransactions(
        TransactionType.DEPOSIT,
        chamaId,
        memberId,
      );
      const memberWithdrawals = await this.aggregateTransactions(
        TransactionType.WITHDRAW,
        chamaId,
        memberId,
      );

      const memberBalance = memberDeposits - memberWithdrawals;

      return {
        memberDeposits,
        memberWithdrawals,
        memberBalance,
      };
    } catch (e) {
      this.logger.error(e);
      return {
        memberDeposits: 0,
        memberWithdrawals: 0,
        memberBalance: 0,
      };
    }
  }

  private async aggregateTransactions(
    type: TransactionType,
    chamaId?: string,
    memberId?: string,
  ): Promise<number> {
    let transactions: number = 0;
    const filter: ChamaTxFilter & {
      status: string;
      type: string;
    } = {
      status: ChamaTxStatus.COMPLETE.toString(),
      type: type.toString(),
    };

    if (memberId) {
      filter.memberId = memberId;
    }

    if (chamaId) {
      filter.chamaId = chamaId;
    }

    this.logger.log(`AGGREGATION FILTER : ${JSON.stringify(filter)}`);

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
          this.logger.log(`AGGREGATION RESULT: ${JSON.stringify(result)}`);
          return result[0]?.totalMsats || 0;
        });
    } catch (e) {
      this.logger.error(
        `Error aggregating transactions: type: ${type}, chamaId: ${chamaId}, memberId: ${memberId}, error: ${e}`,
      );
    }

    return transactions;
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
        status: ChamaTxStatus.FAILED,
      },
    );
  }
}

interface ChamaTxFilter {
  memberId?: string;
  chamaId?: string;
}
