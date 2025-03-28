import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  FedimintContext,
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
  type FedimintReceiveFailureEvent,
  type FedimintReceiveSuccessEvent,
  type SwapStatusChangeEvent,
  initiateOfframpSwap,
  FmLightning,
  ChamaWalletTx,
  parseTransactionStatus,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  ChamaMemberContact,
  ChamaMessageService,
} from '../chamas/chamas.messaging';
import { ChamasService } from '../chamas/chamas.service';
import {
  ChamaWalletDocument,
  ChamaWalletRepository,
  toChamaWalletTx,
} from './db';

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
      FedimintContext.CHAMAWALLET_RECEIVE,
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
      FedimintContext.SOLOWALLET_RECEIVE,
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

    // If member is an admin, add their pre-review
    if (isAdmin) {
      this.logger.log(
        `Member ${memberId} is a chama admin - adding pre-review to withdrawal`,
      );
      initialReviews.push({
        memberId,
        review: Review.APPROVE,
      });
    }

    // Check if requestor is the ONLY admin in the chama
    const isSoleAdmin =
      isAdmin &&
      chama.members.filter((member) =>
        member.roles.includes(ChamaMemberRole.Admin),
      ).length === 1;

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
          isSoleAdmin && initialReviews.length > 0
            ? ChamaTxStatus.APPROVED // Auto-approve only if the sole admin
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

        const admins = (
          await this.users.findUsersById(new Set(adminMemberIds))
        ).map((admin): ChamaMemberContact => {
          return {
            name: admin.profile?.name,
            phoneNumber: admin.phone?.number,
            // nostrNpub: admin.nostr?.npub,
          };
        });

        const beneficiary = await this.users.findUser({
          id: withdrawal.memberId,
        });

        this.messenger.sendChamaWithdrawalRequests(chama, admins, withdrawal, {
          name: beneficiary.profile?.name,
          phoneNumber: beneficiary.phone?.number,
          // nostrNpub: beneficiary.nostr?.npub,
        });
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

  async continueWithdraw({
    memberId,
    txId,
    offramp,
    lightning,
    lnurlRequest,
    pagination,
  }: ChamaContinueWithdrawDto) {
    // Get the transaction record
    const txd = await this.wallet.findOne({ _id: txId });
    const { chamaId } = txd;

    if (txd.memberId !== memberId) {
      throw new Error('Invalid request to continue transaction');
    }

    const status = parseTransactionStatus<ChamaTxStatus>(
      txd.status.toString(),
      ChamaTxStatus.UNRECOGNIZED,
      this.logger,
    );

    // Check if this transaction is already in a final state
    if (
      status === ChamaTxStatus.PROCESSING ||
      status === ChamaTxStatus.COMPLETE ||
      status === ChamaTxStatus.FAILED
    ) {
      throw new Error('Transaction is processing or complete');
    }

    // Check if transaction has status APPROVED - only approved withdrawals can be continued
    if (status !== ChamaTxStatus.APPROVED) {
      throw new Error(
        'Withdrawal must be approved by admins before it can be processed',
      );
    }

    // Get the wallet balances
    const { groupMeta } = await this.getWalletMeta(chamaId, memberId);
    let withdrawal: ChamaWalletDocument;

    if (lightning) {
      // 1. Execute lightning withdrawal that has been approved
      this.logger.log('Processing approved lightning invoice withdrawal');
      this.logger.log(lightning);

      // Decode the invoice to get the amount and details
      const inv = await this.fedimintService.decode(lightning.invoice);
      const invoiceMsats = Number(inv.amountMsats);

      this.logger.log(`Invoice amount: ${invoiceMsats} msats`);

      // Check if chama has enough total balance
      if (invoiceMsats > groupMeta.groupBalance) {
        throw new Error('Invoice amount exceeds available chama balance');
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

        // Update the withdrawal record to complete
        withdrawal = await this.wallet.findOneAndUpdate(
          {
            _id: txId,
            memberId,
          },
          {
            amountMsats: totalWithdrawnMsats,
            lightning: JSON.stringify({ ...lightning, operationId }),
            paymentTracker: operationId,
            status: ChamaTxStatus.COMPLETE,
          },
        );

        this.logger.log(`Withdrawal completed with ID: ${withdrawal._id}`);
      } catch (error) {
        this.logger.error('Failed to pay lightning invoice', error);

        // Update transaction to failed state
        await this.wallet.findOneAndUpdate(
          { _id: txId },
          { status: ChamaTxStatus.FAILED },
        );

        throw new Error(
          `Failed to process lightning payment: ${error.message}`,
        );
      }
    } else if (lnurlRequest) {
      // 2. Execute LNURL withdrawal that has been approved
      this.logger.log('Processing approved LNURL withdrawal');

      const maxWithdrawableMsats = txd.amountMsats;

      this.logger.log(`Max withdrawable amount: ${maxWithdrawableMsats} msats`);
      this.logger.log(`Current chama balance: ${groupMeta.groupBalance} msats`);

      // Check if chama has sufficient balance
      if (maxWithdrawableMsats > groupMeta.groupBalance) {
        throw new Error('Insufficient chama funds for LNURL withdrawal');
      }

      if (maxWithdrawableMsats <= 0) {
        throw new Error('Insufficient balance for withdrawal');
      }

      try {
        // Create a new LNURL withdraw point
        const lnurlWithdrawPoint =
          await this.fedimintService.createLnUrlWithdrawPoint(
            maxWithdrawableMsats,
            Math.min(1000, maxWithdrawableMsats),
            txd.reference || 'Bitsacco Chama Savings withdrawal',
          );

        this.logger.log(
          `LNURL withdrawal access point created. LNURL: ${lnurlWithdrawPoint.lnurl}`,
        );

        const fmLightning: FmLightning = {
          lnurlWithdrawPoint,
        };

        withdrawal = await this.wallet.findOneAndUpdate(
          { _id: txId, memberId },
          {
            lightning: JSON.stringify(fmLightning),
            paymentTracker: lnurlWithdrawPoint.k1,
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
      // 3. Execute offramp withdrawal that has been approved
      this.logger.log('Processing approved offramp withdrawal');

      // Double check if chama has enough total balance
      if (txd.amountMsats > groupMeta.groupBalance) {
        throw new Error('Insufficient chama funds for offramp withdrawal');
      }

      try {
        // Initiate offramp swap
        const {
          status,
          amountMsats: offrampMsats,
          invoice,
          swapTracker,
        } = await initiateOfframpSwap<ChamaTxStatus>(
          {
            amountFiat: txd.amountFiat.toString(),
            reference: txd.reference,
            target: offramp,
          },
          this.swapService,
          this.logger,
        );

        // Pay the invoice for the swap
        const { operationId, fee } = await this.fedimintService.pay(invoice);

        // Calculate total withdrawal amount including fee
        const totalOfframpMsats = offrampMsats + fee;

        // Update withdrawal record to complete
        withdrawal = await this.wallet.findOneAndUpdate(
          {
            _id: txId,
          },
          {
            amountMsats: totalOfframpMsats,
            lightning: JSON.stringify({ invoice, operationId }),
            paymentTracker: swapTracker,
            status,
          },
        );

        this.logger.log(
          `Offramp withdrawal completed with ID: ${withdrawal._id}`,
        );
      } catch (error) {
        this.logger.error('Failed to process offramp payment', error);

        // Update transaction to failed state
        await this.wallet.findOneAndUpdate(
          { _id: txId },
          { status: ChamaTxStatus.FAILED },
        );

        throw new Error(`Failed to process offramp payment: ${error.message}`);
      }
    } else {
      throw new Error(
        'No withdrawal method provided (lightning invoice, LNURL, or offramp)',
      );
    }

    // Get updated transaction ledger
    const ledger = await this.getPaginatedChamaTransactions({
      memberId,
      chamaId,
      pagination,
      priority: withdrawal._id,
    });

    // Get updated wallet balance
    const updateMeta = await this.getWalletMeta(chamaId, memberId);

    return {
      txId: withdrawal._id,
      ledger,
      groupMeta: updateMeta.groupMeta,
      memberMeta: updateMeta.memberMeta,
    };
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
        status: ChamaTxStatus.FAILED,
      },
    );
  }

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
        `Updated chamawallet transaction ${txd._id} to status: ${swapStatus}`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating chamawallet transaction for swap: ${payload.swapTracker}`,
        error,
      );
    }
  }

  /**
   * Find a approved LNURL withdrawal transaction by k1
   * @param k1 The k1 identifier from the LNURL withdrawal request
   * @returns The transaction document if found, null otherwise
   */
  async findApprovedLnurlWithdrawal(k1: string): Promise<ChamaWalletTx | null> {
    this.logger.log(`Looking for pending chama withdrawal with k1: ${k1}`);

    try {
      // Find transaction by paymentTracker (which stores the k1 value)
      const doc = await this.wallet.findOne({
        paymentTracker: k1,
        type: TransactionType.WITHDRAW.toString(),
      });

      if (!doc) {
        this.logger.log(`No chama withdrawal found with k1: ${k1}`);
        return null;
      }

      const status = parseTransactionStatus<ChamaTxStatus>(
        doc.status.toString(),
        ChamaTxStatus.UNRECOGNIZED,
        this.logger,
      );

      if (status !== ChamaTxStatus.APPROVED) {
        this.logger.log(`TRANSACTION STATUS: ${status}`);
        throw new Error('Transaction is not in approved state');
      }

      return toChamaWalletTx(doc, this.logger);
    } catch (error) {
      this.logger.error(
        `Error finding pending chama withdrawal: ${error.message}`,
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
    this.logger.log(`Processing chama LNURL withdraw callback with k1: ${k1}`);

    try {
      // 1. Find the pending withdrawal record using the k1 value
      const withdrawal = await this.wallet.findOne({
        paymentTracker: k1,
        status: ChamaTxStatus.APPROVED,
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
      // Total amount charged = actual withdrawn amount plus fee paid
      const amountMsats = Number(invoiceDetails.amountMsats) + fee;

      // 5. Update the withdrawal record
      const updatedWithdrawal = await this.wallet.findOneAndUpdate(
        { _id: withdrawal._id },
        {
          status: ChamaTxStatus.COMPLETE,
          amountMsats: amountMsats,
          updatedAt: new Date(),
          lightning: JSON.stringify({
            invoice: pr,
            operationId,
          }),
        },
      );

      this.logger.log(
        `Chama LNURL withdrawal successfully completed for ID: ${updatedWithdrawal._id}`,
      );

      return {
        success: true,
        message: 'Withdrawal successful',
        txId: updatedWithdrawal._id,
      };
    } catch (error) {
      this.logger.error(
        'Failed to process chama LNURL withdraw callback',
        error,
      );

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
  async checkLnUrlWithdrawStatus(withdrawId: string): Promise<ChamaWalletTx> {
    this.logger.log(`Checking status of chama LNURL withdrawal: ${withdrawId}`);

    const doc = await this.wallet.findOne({ _id: withdrawId });

    if (!doc) {
      throw new Error('Withdrawal request not found');
    }

    return toChamaWalletTx(doc, this.logger);
  }
}

interface ChamaTxFilter {
  memberId?: string;
  chamaId?: string;
}
