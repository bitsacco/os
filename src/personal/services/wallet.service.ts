import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
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
  LockPeriod,
} from '../../common';
import { SwapService } from '../../swap/swap.service';
import {
  SolowalletDocument,
  SolowalletRepository,
  toSolowalletTx,
} from '../db';
import {
  CreateWalletDto,
  CreateTargetWalletDto,
  CreateLockedWalletDto,
  UpdateWalletDto,
  UpdateTargetWalletDto,
  UpdateLockedWalletDto,
  WalletResponseDto,
  WalletListResponseDto,
  WalletQueryDto,
} from '../dto';

@Injectable()
export class PersonalWalletService {
  private readonly logger = new Logger(PersonalWalletService.name);

  constructor(
    private readonly wallet: SolowalletRepository,
    private readonly fedimintService: FedimintService,
    private readonly eventEmitter: EventEmitter2,
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

  getLegacyDefaultWalletId(userId: string) {
    // Define default STANDARD wallet ID for legacy transactions
    return `standard_${userId}`;
  }

  /**
   * Create a new wallet variant
   */
  async createWallet(
    userId: string,
    createWalletDto:
      | CreateWalletDto
      | CreateTargetWalletDto
      | CreateLockedWalletDto,
  ): Promise<WalletResponseDto> {
    this.logger.log(
      `Creating ${createWalletDto.walletType} wallet for user ${userId}`,
    );

    const walletId = uuidv4();
    const baseWalletData = {
      userId,
      walletId,
      walletType: createWalletDto.walletType,
      walletName: createWalletDto.walletName,
      tags: createWalletDto.tags,
      category: createWalletDto.category,
      notes: createWalletDto.notes,
    };

    let extendedWalletData = { ...baseWalletData };

    // Type-specific configuration
    if (createWalletDto.walletType === WalletType.TARGET) {
      const targetDto = createWalletDto as CreateTargetWalletDto;

      // Validate that at least one target amount is provided
      if (!targetDto.targetAmountMsats && !targetDto.targetAmountFiat) {
        throw new BadRequestException(
          'Either targetAmountMsats or targetAmountFiat must be provided for target wallets',
        );
      }

      extendedWalletData = {
        ...extendedWalletData,
        ...(targetDto.targetAmountMsats && {
          targetAmountMsats: targetDto.targetAmountMsats,
        }),
        ...(targetDto.targetAmountFiat && {
          targetAmountFiat: targetDto.targetAmountFiat,
        }),
        ...(targetDto.targetDate && { targetDate: targetDto.targetDate }),
      } as any;
    } else if (createWalletDto.walletType === WalletType.LOCKED) {
      const lockedDto = createWalletDto as CreateLockedWalletDto;
      const lockEndDate = calculateLockEndDate(
        lockedDto.lockPeriod,
        lockedDto.lockEndDate,
      );

      extendedWalletData = {
        ...extendedWalletData,
        ...(lockedDto.lockPeriod && { lockPeriod: lockedDto.lockPeriod }),
        lockEndDate,
        autoRenew: lockedDto.autoRenew || false,
        penaltyRate: lockedDto.penaltyRate || 10, // Default 10% penalty
      } as any;
    }

    // Create initial transaction record with wallet metadata
    const initialTx = await this.wallet.create({
      userId,
      amountMsats: 0,
      type: TransactionType.WALLET_CREATION,
      status: TransactionStatus.COMPLETE,
      lightning: '',
      paymentTracker: '',
      reference: `wallet_creation_${walletId}`,
      __v: 0,
      ...(extendedWalletData as any),
    });

    // Emit wallet creation event
    this.eventEmitter.emit('wallet.created', {
      userId,
      walletId,
      walletType: createWalletDto.walletType,
      createdAt: new Date(),
    });

    return this.buildWalletResponse(initialTx);
  }

  /**
   * Get wallet by ID
   */
  async getWallet(
    userId: string,
    walletId: string,
  ): Promise<WalletResponseDto> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);
    return this.buildWalletResponse(wallet);
  }

  /**
   * List user's wallets with filtering
   */
  async getWallets(
    userId: string,
    query: WalletQueryDto,
  ): Promise<WalletListResponseDto> {
    const filter: any = { userId };

    if (query.walletType) {
      filter.walletType = query.walletType;
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.tags) {
      const tags = query.tags.split(',').map((tag) => tag.trim());
      filter.tags = { $in: tags };
    }

    const DEFAULT_STANDARD_WALLET_ID = this.getLegacyDefaultWalletId(userId);

    // Get all wallet transactions grouped by walletId
    const pipeline = [
      {
        $match: {
          ...filter,
          status: {
            $in: [
              TransactionStatus.COMPLETE.toString(),
              TransactionStatus.MANUAL_REVIEW.toString(),
            ],
          },
        },
      },
      // Add a stage to set default walletId for transactions without one
      {
        $addFields: {
          walletId: {
            $ifNull: ['$walletId', DEFAULT_STANDARD_WALLET_ID],
          },
        },
      },
      { $sort: { createdAt: -1 as -1 } },
      {
        $group: {
          _id: '$walletId',
          latestTx: { $first: '$$ROOT' },
          totalBalance: {
            $sum: {
              $switch: {
                branches: [
                  {
                    case: {
                      $eq: ['$type', TransactionType.DEPOSIT.toString()],
                    },
                    then: '$amountMsats',
                  },
                  {
                    case: {
                      $eq: ['$type', TransactionType.WITHDRAW.toString()],
                    },
                    then: { $multiply: ['$amountMsats', -1] },
                  },
                  {
                    case: {
                      $eq: [
                        '$type',
                        TransactionType.WALLET_CREATION.toString(),
                      ],
                    },
                    then: 0,
                  },
                ],
                default: 0,
              },
            },
          },
          txCount: { $sum: 1 },
        },
      },
    ];

    const walletGroups = await this.wallet.aggregate(pipeline);

    let wallets = walletGroups.map((group) => {
      const wallet = {
        ...group.latestTx,
        balance: group.totalBalance,
        walletId: group._id,
        walletType: group.latestTx.walletType,
        walletName: group.latestTx.walletName,
      };

      // Mark the default wallet by its predictable ID
      if (group._id === DEFAULT_STANDARD_WALLET_ID) {
        wallet.isDefaultWallet = true;
      }

      return wallet;
    });

    // Ensure default wallet exists in database
    await this.ensureDefaultWalletExists(userId);

    // Re-run the aggregation to include the default wallet if it was just created
    const hasDefaultWallet = wallets.some(
      (w) => w.walletId === DEFAULT_STANDARD_WALLET_ID,
    );

    if (!hasDefaultWallet) {
      const updatedWalletGroups = await this.wallet.aggregate(pipeline);
      const newWallets = updatedWalletGroups.map((group) => {
        const wallet = {
          ...group.latestTx,
          balance: group.totalBalance,
          walletId: group._id,
          walletType: group.latestTx.walletType,
          walletName: group.latestTx.walletName,
        };

        // Mark the default wallet by its predictable ID
        if (group._id === DEFAULT_STANDARD_WALLET_ID) {
          wallet.isDefaultWallet = true;
        }

        return wallet;
      });
      wallets = newWallets;
    }

    // Apply activeOnly filter
    if (query.activeOnly) {
      wallets = wallets.filter((wallet) => wallet.balance > 0);
    }

    const walletResponses = await Promise.all(
      wallets.map((wallet) =>
        this.buildWalletResponse(wallet, {
          includeLockInfo: query.includeLockInfo,
          includeProgress: query.includeProgress,
        }),
      ),
    );

    const totalBalance = wallets.reduce(
      (sum, wallet) => sum + wallet.balance,
      0,
    );

    return {
      wallets: walletResponses,
      total: wallets.length,
      totalBalance,
    };
  }

  /**
   * Update wallet configuration
   */
  async updateWallet(
    userId: string,
    walletId: string,
    updateDto: UpdateWalletDto | UpdateTargetWalletDto | UpdateLockedWalletDto,
  ): Promise<WalletResponseDto> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    const updateData: any = {
      walletName: updateDto.walletName || wallet.walletName,
      tags: updateDto.tags || wallet.tags,
      category: updateDto.category || wallet.category,
      notes: updateDto.notes || wallet.notes,
    };

    // Type-specific updates
    if (
      wallet.walletType === WalletType.TARGET &&
      ('targetAmountMsats' in updateDto || 'targetAmountFiat' in updateDto)
    ) {
      const targetDto = updateDto as UpdateTargetWalletDto;
      updateData.targetAmountMsats =
        targetDto.targetAmountMsats !== undefined
          ? targetDto.targetAmountMsats
          : wallet.targetAmountMsats;
      updateData.targetAmountFiat =
        targetDto.targetAmountFiat !== undefined
          ? targetDto.targetAmountFiat
          : wallet.targetAmountFiat;
      updateData.targetDate = targetDto.targetDate || wallet.targetDate;

      // Recalculate progress if target amount changed
      if (
        (targetDto.targetAmountMsats &&
          targetDto.targetAmountMsats !== wallet.targetAmountMsats) ||
        (targetDto.targetAmountFiat &&
          targetDto.targetAmountFiat !== wallet.targetAmountFiat)
      ) {
        const { currentBalance } = await this.getWalletMeta(userId, walletId);
        const targetAmount =
          targetDto.targetAmountMsats || wallet.targetAmountMsats;
        if (targetAmount) {
          updateData.progressPercentage = Math.min(
            (currentBalance / targetAmount) * 100,
            100,
          );
        }
      }
    } else if (
      wallet.walletType === WalletType.LOCKED &&
      'autoRenew' in updateDto
    ) {
      const lockedDto = updateDto as UpdateLockedWalletDto;
      updateData.autoRenew =
        lockedDto.autoRenew !== undefined
          ? lockedDto.autoRenew
          : wallet.autoRenew;
      updateData.penaltyRate =
        lockedDto.penaltyRate !== undefined
          ? lockedDto.penaltyRate
          : wallet.penaltyRate;
    }

    const updatedWallet = await this.wallet.findOneAndUpdate(
      { userId, walletId, type: TransactionType.WALLET_CREATION },
      updateData,
    );

    if (!updatedWallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Emit wallet update event
    this.eventEmitter.emit('wallet.updated', {
      userId,
      walletId,
      updateData,
      updatedAt: new Date(),
    });

    return this.buildWalletResponse(updatedWallet);
  }

  /**
   * Delete a wallet (only if balance is zero)
   */
  async deleteWallet(userId: string, walletId: string): Promise<void> {
    const { currentBalance } = await this.getWalletMeta(userId, walletId);

    if (currentBalance > 0) {
      throw new BadRequestException(
        'Cannot delete wallet with non-zero balance',
      );
    }

    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (wallet.walletType === WalletType.LOCKED && isWalletLocked(wallet)) {
      throw new BadRequestException(
        'Cannot delete locked wallet before lock expires',
      );
    }

    // TODO: Implement proper wallet deletion logic
    // For now, we're not deleting transactions to preserve historical data
    // await this.wallet.deleteMany({ userId, walletId });

    // Emit wallet deletion event
    this.eventEmitter.emit('wallet.deleted', {
      userId,
      walletId,
      walletType: wallet.walletType,
      deletedAt: new Date(),
    });

    this.logger.log(`Deleted wallet ${walletId} for user ${userId}`);
  }

  private async buildWalletResponse(
    wallet: SolowalletDocument,
    options: { includeLockInfo?: boolean; includeProgress?: boolean } = {},
  ): Promise<WalletResponseDto> {
    const { currentBalance } = await this.getWalletMeta(
      wallet.userId,
      wallet.walletId,
    );

    const response: WalletResponseDto = {
      walletId: wallet.walletId!,
      userId: wallet.userId,
      walletType: wallet.walletType || WalletType.STANDARD,
      walletName: wallet.walletName,
      balance: currentBalance,
      tags: wallet.tags,
      category: wallet.category,
      notes: wallet.notes,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };

    // Add progress information for target wallets
    if (
      (wallet.walletType === WalletType.TARGET || options.includeProgress) &&
      (wallet.targetAmountMsats || wallet.targetAmountFiat)
    ) {
      response.progress = {
        currentAmountMsats: currentBalance,
        currentAmountFiat: wallet.amountFiat,
        targetAmountMsats: wallet.targetAmountMsats,
        targetAmountFiat: wallet.targetAmountFiat,
        progressPercentage: wallet.progressPercentage || 0,
        milestoneReached: wallet.milestoneReached || [],
        projectedCompletionDate: calculateProjectedCompletion(
          wallet,
          currentBalance,
        ),
      };
    }

    // Add lock information for locked wallets
    if (
      (wallet.walletType === WalletType.LOCKED || options.includeLockInfo) &&
      wallet.lockEndDate
    ) {
      const now = new Date();
      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (wallet.lockEndDate.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );

      response.lockInfo = {
        lockPeriod: wallet.lockPeriod!,
        lockEndDate: wallet.lockEndDate,
        isLocked: isWalletLocked(wallet),
        autoRenew: wallet.autoRenew || false,
        penaltyRate: wallet.penaltyRate || 0,
        canWithdrawEarly: true, // Most implementations allow early withdrawal with penalty
        daysRemaining,
      };
    }

    return response;
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

  private async aggregateTransactionsByStatus(
    userId: string,
    walletId: string,
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

      const DEFAULT_STANDARD_WALLET_ID = this.getLegacyDefaultWalletId(userId);

      transactions = await this.wallet
        .aggregate([
          {
            $match: {
              userId: userId,
              status: statusFilter,
              type: type.toString(),
            },
          },
          // Add a stage to set default walletId for transactions without one
          {
            $addFields: {
              walletId: {
                $ifNull: ['$walletId', DEFAULT_STANDARD_WALLET_ID],
              },
            },
          },
          {
            $match: {
              walletId: walletId,
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
    walletId: string,
    type: TransactionType,
  ): Promise<number> {
    return this.aggregateTransactionsByStatus(userId, walletId, type, [
      TransactionStatus.COMPLETE,
      TransactionStatus.MANUAL_REVIEW,
    ]);
  }

  private async aggregateProcessingTransactions(
    userId: string,
    walletId: string,
    type: TransactionType,
  ): Promise<number> {
    return this.aggregateTransactionsByStatus(
      userId,
      walletId,
      type,
      TransactionStatus.PROCESSING,
    );
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

    return this.wallet.findOneAndUpdateWithVersion
      ? this.wallet.findOneAndUpdateWithVersion(
          { _id: transactionId },
          {
            status: newStatus,
            stateChangedAt: now,
            timeoutAt,
            ...additionalUpdates,
          },
          currentVersion,
        )
      : this.wallet.findOneAndUpdate(
          { _id: transactionId },
          {
            status: newStatus,
            stateChangedAt: now,
            timeoutAt,
            ...additionalUpdates,
          },
        );
  }

  async getWalletMeta(userId: string, walletId: string): Promise<WalletMeta> {
    const totalDeposits = await this.aggregateUserTransactions(
      userId,
      walletId,
      TransactionType.DEPOSIT,
    );
    const totalWithdrawals = await this.aggregateUserTransactions(
      userId,
      walletId,
      TransactionType.WITHDRAW,
    );
    const processingWithdrawals = await this.aggregateProcessingTransactions(
      userId,
      walletId,
      TransactionType.WITHDRAW,
    );

    const currentBalance =
      totalDeposits - totalWithdrawals - processingWithdrawals;

    return {
      totalDeposits,
      totalWithdrawals,
      currentBalance,
    };
  }

  private async checkWalletType(userId: string, walletId: string) {
    try {
      const wallet = await this.findWalletByUserAndId(userId, walletId);
      return wallet.walletType || WalletType.STANDARD;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(`Invalid wallet ID: ${walletId}`);
      }
      throw error;
    }
  }

  async depositToWallet({
    userId,
    amountFiat,
    amountMsats: requestedAmountMsats,
    reference,
    onramp,
    pagination,
    walletId,
  }: DepositFundsRequestDto & {
    walletId: string;
  }): Promise<UserTxsResponse> {
    // const startTime = Date.now();  // Uncomment if timing metrics needed
    let errorType: string | undefined;

    try {
      const walletType = await this.checkWalletType(userId, walletId);

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
        walletId,
        walletType,
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

      const meta = await this.getWalletMeta(userId, walletId);

      // Update wallet-specific progress/status after successful deposit
      await this.updateWalletProgress(userId, walletId, walletType);

      return {
        txId: deposit._id,
        ledger,
        meta,
        userId,
      };
    } catch (error) {
      errorType = error.message || 'Unknown error';
      this.logger.error(`Deposit failed: ${errorType}`, error.stack);

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

    const resolvedWalletId =
      tx.walletId || this.getLegacyDefaultWalletId(userId);
    const meta = await this.getWalletMeta(userId, resolvedWalletId);

    return {
      txId: deposit._id,
      ledger,
      meta,
      userId,
    };
  }

  /**
   * Get transaction history for user's personal wallets
   * Uses the same pagination pattern as SolowalletService but with wallet filtering
   */
  async getTransactionHistory(userId: string, query: any = {}): Promise<any> {
    const {
      walletId,
      page = default_page,
      size = default_page_size,
      type,
      status,
      startDate,
      endDate,
    } = query;

    // Build filter using the same pattern as SolowalletService
    const filter: any = { userId };

    // Add wallet filtering for personal savings
    if (walletId) {
      filter.walletId = walletId;
    }

    // Add type filter
    if (type) {
      filter.type = type;
    }

    // Add status filter
    if (status) {
      filter.status = status;
    }

    // Add date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Use the same pagination logic as SolowalletService
    const allTx = await this.wallet.find(filter, { createdAt: -1 });

    const pages = Math.ceil(allTx.length / size);
    const selectPage = page > pages ? pages - 1 : page;

    const transactions = allTx
      .slice(selectPage * size, (selectPage + 1) * size)
      .map((doc) => {
        const tx = toSolowalletTx(doc, this.logger);
        return {
          id: tx.id,
          walletId: doc.walletId,
          walletType: doc.walletType,
          walletName: doc.walletName,
          type: tx.type,
          status: tx.status,
          amountMsats: tx.amountMsats,
          amountFiat: tx.amountFiat || 0,
          description: getTransactionDescription(doc),
          reference: tx.reference,
          createdAt: tx.createdAt,
          updatedAt: tx.updatedAt,
          completedAt:
            tx.status === TransactionStatus.COMPLETE ? tx.updatedAt : undefined,
          metadata: {
            isLegacyTransaction: !doc.walletId,
            lightning: tx.lightning,
            paymentTracker: doc.paymentTracker,
          },
        };
      });

    return {
      transactions,
      pagination: {
        page: selectPage,
        size,
        totalCount: allTx.length,
        totalPages: pages,
        hasMore: selectPage * size < allTx.length,
      },
    };
  }

  /**
   * Get specific transaction details
   * Uses the same pattern as SolowalletService findTransaction but with enhanced response
   */
  async getTransaction(userId: string, transactionId: string): Promise<any> {
    const filterQuery = { _id: transactionId };
    if (userId) {
      // If userId is provided, ensure we only return transactions owned by this user
      filterQuery['userId'] = userId;
    }
    const transaction = await this.wallet.findOne(filterQuery);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Use the same transformation as SolowalletService but with wallet context
    const tx = toSolowalletTx(transaction, this.logger);

    return {
      id: tx.id,
      walletId: transaction.walletId,
      walletType: transaction.walletType,
      walletName: transaction.walletName,
      type: tx.type,
      status: tx.status,
      amountMsats: tx.amountMsats,
      amountFiat: tx.amountFiat || 0,
      description: getTransactionDescription(transaction),
      reference: tx.reference,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      completedAt:
        tx.status === TransactionStatus.COMPLETE ? tx.updatedAt : undefined,
      metadata: {
        isLegacyTransaction: !transaction.walletId,
        lightning: tx.lightning,
        paymentTracker: transaction.paymentTracker,
      },
    };
  }

  /**
   * Get transaction history for a specific wallet
   */
  async getWalletTransactions(
    userId: string,
    walletId: string,
    query: any = {},
  ): Promise<any> {
    // Delegate to getTransactionHistory with walletId filter
    return this.getTransactionHistory(userId, { ...query, walletId });
  }

  /**
   * Get transaction history for a specific wallet by wallet ID (without userId)
   */
  async getWalletTransactionsByWalletId(
    walletId: string,
    query: any = {},
  ): Promise<any> {
    // First, find the wallet to get the userId
    const wallet = await this.wallet.findOne({
      walletId,
      type: TransactionType.WALLET_CREATION,
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Use the existing getTransactionHistory method with the found userId
    return this.getTransactionHistory(wallet.userId, {
      ...query,
      walletId,
    });
  }

  async userTransactions({
    userId,
    pagination,
  }: UserTxsRequestDto): Promise<UserTxsResponse> {
    // Use the exact same pattern as SolowalletService for backward compatibility
    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination,
    });
    const resolvedWalletId = this.getLegacyDefaultWalletId(userId);
    const meta = await this.getWalletMeta(userId, resolvedWalletId);

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
    // Use the exact same pattern as SolowalletService
    const filterQuery = { _id: txId };
    if (userId) {
      // If userId is provided, ensure we only return transactions owned by this user
      filterQuery['userId'] = userId;
    }
    const doc = await this.wallet.findOne(filterQuery);
    return toSolowalletTx(doc, this.logger);
  }

  async withdrawFromWallet({
    userId,
    amountFiat,
    reference,
    offramp,
    lightning,
    lnurlRequest,
    pagination,
    idempotencyKey,
    walletId,
  }: WithdrawFundsRequestDto & {
    walletId: string;
  }): Promise<UserTxsResponse> {
    const walletType = await this.checkWalletType(userId, walletId);

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
          const resolvedWalletId =
            walletId || this.getLegacyDefaultWalletId(userId);
          const meta = await this.getWalletMeta(userId, resolvedWalletId);
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

    const resolvedWalletId = walletId || this.getLegacyDefaultWalletId(userId);
    const { currentBalance } = await this.getWalletMeta(
      userId,
      resolvedWalletId,
    );
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
          walletId,
          walletType,
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
          walletId: walletId || this.getLegacyDefaultWalletId(userId),
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
          walletId: walletId || this.getLegacyDefaultWalletId(userId),
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
    const meta = await this.getWalletMeta(userId, resolvedWalletId);

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

    const resolvedWalletId =
      tx.walletId || this.getLegacyDefaultWalletId(userId);
    const { currentBalance } = await this.getWalletMeta(
      userId,
      resolvedWalletId,
    );
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
    const meta = await this.getWalletMeta(userId, resolvedWalletId);

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
    const resolvedWalletId = this.getLegacyDefaultWalletId(userId);
    const meta = await this.getWalletMeta(userId, resolvedWalletId);

    return {
      txId: originTx._id,
      ledger,
      meta,
      userId,
    };
  }

  /**
   * Ensure default wallet exists for user
   */
  async ensureDefaultWalletExists(userId: string): Promise<void> {
    const DEFAULT_STANDARD_WALLET_ID = this.getLegacyDefaultWalletId(userId);

    // Check if default wallet already exists (always use the predictable ID for simplicity)
    // Use find() instead of findOne() to avoid exception when document doesn't exist
    const existingDefaultWallets = await this.wallet.find({
      userId,
      walletId: DEFAULT_STANDARD_WALLET_ID,
      type: TransactionType.WALLET_CREATION,
    });
    const existingDefaultWallet =
      existingDefaultWallets.length > 0 ? existingDefaultWallets[0] : null;

    if (!existingDefaultWallet) {
      // Create the default wallet record
      await this.wallet.create({
        userId,
        walletId: DEFAULT_STANDARD_WALLET_ID,
        walletType: WalletType.STANDARD,
        walletName: 'Default Wallet',
        amountMsats: 0,
        type: TransactionType.WALLET_CREATION,
        status: TransactionStatus.COMPLETE,
        lightning: `default_wallet_${userId}`,
        paymentTracker: `default_wallet_tracker_${userId}`,
        reference: `default_wallet_creation_${userId}`,
        __v: 0,
      });

      // Migrate any legacy transactions to the default wallet
      await this.migrateLegacyTransactions(userId, DEFAULT_STANDARD_WALLET_ID);

      this.logger.log(`Created default wallet for user ${userId}`);
    }
  }

  /**
   * Migrate legacy transactions (without walletId) to the default wallet
   */
  async migrateLegacyTransactions(
    userId: string,
    defaultWalletId: string,
  ): Promise<void> {
    // Update all transactions for this user that don't have a walletId
    const result = await this.wallet.updateMany(
      {
        userId,
        walletId: { $exists: false },
      },
      {
        $set: {
          walletId: defaultWalletId,
          walletType: WalletType.STANDARD,
          walletName: 'Default Wallet',
        },
      },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(
        `Migrated ${result.modifiedCount} legacy transactions to default wallet for user ${userId}`,
      );
    }
  }

  /**
   * Update wallet-specific progress/status after successful deposit or withdrawal
   */
  async updateWalletProgress(
    userId: string,
    walletId: string,
    walletType: WalletType,
  ): Promise<void> {
    if (walletType === WalletType.TARGET) {
      const wallet = await this.findWalletByUserAndId(userId, walletId);
      const { currentBalance } = await this.getWalletMeta(userId, walletId);

      // Use msats target amount as primary, fall back to fiat if needed
      const targetAmount = wallet.targetAmountMsats || wallet.targetAmountFiat;

      if (targetAmount) {
        const progressPercentage = Math.min(
          (currentBalance / targetAmount) * 100,
          100,
        );
        const currentProgress = wallet.progressPercentage || 0;

        // Check for milestone achievements
        const milestones = [25, 50, 75, 100];
        const newMilestones = milestones.filter(
          (milestone) =>
            progressPercentage >= milestone && currentProgress < milestone,
        );

        if (newMilestones.length > 0) {
          const updatedMilestones = [
            ...(wallet.milestoneReached || []),
            ...newMilestones.map(() => new Date()),
          ];

          await this.wallet.findOneAndUpdate(
            { userId, walletId, type: TransactionType.WALLET_CREATION },
            {
              progressPercentage,
              milestoneReached: updatedMilestones,
            },
          );

          // Emit milestone events
          newMilestones.forEach((milestone) => {
            this.eventEmitter.emit('wallet.milestone', {
              userId,
              walletId,
              milestone,
              progressPercentage,
              achievedAt: new Date(),
            });
          });
        } else {
          await this.wallet.findOneAndUpdate(
            { userId, walletId, type: TransactionType.WALLET_CREATION },
            { progressPercentage },
          );
        }
      }
    }
  }

  /**
   * Helper method to find wallet by user ID and wallet ID
   */
  private async findWalletByUserAndId(
    userId: string,
    walletId: string,
  ): Promise<SolowalletDocument> {
    const DEFAULT_STANDARD_WALLET_ID = this.getLegacyDefaultWalletId(userId);

    // Ensure default wallet exists if we're looking for it (legacy format)
    if (walletId === DEFAULT_STANDARD_WALLET_ID) {
      await this.ensureDefaultWalletExists(userId);
    }

    // Normal wallet lookup
    const wallet = await this.wallet.findOne({
      userId,
      walletId,
      type: TransactionType.WALLET_CREATION,
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
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

// Locked Wallet Service
const calculateLockEndDate = (
  lockPeriod: LockPeriod,
  customEndDate?: Date,
): Date => {
  if (lockPeriod === LockPeriod.CUSTOM && customEndDate) {
    return customEndDate;
  }

  const now = new Date();
  switch (lockPeriod) {
    case LockPeriod.ONE_MONTH:
      return new Date(now.setMonth(now.getMonth() + 1));
    case LockPeriod.THREE_MONTHS:
      return new Date(now.setMonth(now.getMonth() + 3));
    case LockPeriod.SIX_MONTHS:
      return new Date(now.setMonth(now.getMonth() + 6));
    case LockPeriod.ONE_YEAR:
      return new Date(now.setFullYear(now.getFullYear() + 1));
    default:
      throw new BadRequestException('Invalid lock period');
  }
};

const calculateProjectedCompletion = (
  wallet: SolowalletDocument,
  currentBalance: number,
): Date | undefined => {
  const targetAmount = wallet.targetAmountMsats || wallet.targetAmountFiat;
  if (!targetAmount || !wallet.targetDate) return undefined;

  // Simple projection based on target date
  // In a real implementation, you might analyze historical deposit patterns
  // const daysRemaining = Math.ceil(
  //   (wallet.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  // );
  const remainingAmount = targetAmount - currentBalance;

  if (remainingAmount <= 0) {
    return new Date(); // Already completed
  }

  // Assume current saving rate continues
  // const requiredDailyRate = remainingAmount / Math.max(1, daysRemaining);

  // Project completion based on required rate (simplified)
  return wallet.targetDate;
};

const isWalletLocked = (wallet: SolowalletDocument): boolean => {
  if (wallet.walletType !== WalletType.LOCKED || !wallet.lockEndDate) {
    return false;
  }
  return new Date() < wallet.lockEndDate;
};

const getTransactionDescription = (transaction: any): string => {
  // Generate description based on transaction type and context
  switch (transaction.type) {
    case TransactionType.DEPOSIT:
      return 'Deposit to wallet';
    case TransactionType.WITHDRAW:
      return 'Withdrawal from wallet';
    case TransactionType.WALLET_CREATION:
      return 'Wallet created';
    default:
      return 'Transaction';
  }
};
