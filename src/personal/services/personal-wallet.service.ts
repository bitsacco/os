import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import {
  DepositFundsRequestDto,
  WithdrawFundsRequestDto,
  WalletType,
  LockPeriod,
  TransactionType,
  TransactionStatus,
} from '../../common';
import { SolowalletService } from '../../solowallet/solowallet.service';
import { SolowalletRepository, SolowalletDocument } from '../../solowallet/db';
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
    private readonly solowalletService: SolowalletService,
    private readonly solowalletRepository: SolowalletRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('PersonalWalletService initialized');
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
      const lockEndDate = this.calculateLockEndDate(
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
    const initialTx = await this.solowalletRepository.create({
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

    // Get all wallet transactions grouped by walletId
    const pipeline = [
      { $match: filter },
      { $sort: { createdAt: -1 as -1 } },
      {
        $group: {
          _id: '$walletId',
          latestTx: { $first: '$$ROOT' },
          totalBalance: {
            $sum: {
              $cond: [
                { $eq: ['$type', TransactionType.DEPOSIT] },
                '$amountMsats',
                { $multiply: ['$amountMsats', -1] },
              ],
            },
          },
          txCount: { $sum: 1 },
        },
      },
    ];

    const walletGroups = await this.solowalletRepository.aggregate(pipeline);

    let wallets = walletGroups
      .filter((group) => group.latestTx.walletId) // Only include wallet variants
      .map((group) => ({
        ...group.latestTx,
        balance: group.totalBalance,
      }));

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
        const currentBalance = await this.getWalletBalance(userId, walletId);
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

    const updatedWallet = await this.solowalletRepository.findOneAndUpdate(
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
    const balance = await this.getWalletBalance(userId, walletId);

    if (balance > 0) {
      throw new BadRequestException(
        'Cannot delete wallet with non-zero balance',
      );
    }

    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (
      wallet.walletType === WalletType.LOCKED &&
      this.isWalletLocked(wallet)
    ) {
      throw new BadRequestException(
        'Cannot delete locked wallet before lock expires',
      );
    }

    // TODO: Implement proper wallet deletion logic
    // For now, we're not deleting transactions to preserve historical data
    // await this.solowalletRepository.deleteMany({ userId, walletId });

    // Emit wallet deletion event
    this.eventEmitter.emit('wallet.deleted', {
      userId,
      walletId,
      walletType: wallet.walletType,
      deletedAt: new Date(),
    });

    this.logger.log(`Deleted wallet ${walletId} for user ${userId}`);
  }

  /**
   * Deposit funds to a specific wallet
   */
  async depositToWallet(
    userId: string,
    walletId: string,
    depositDto: DepositFundsRequestDto,
  ) {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    // Add wallet context to the deposit request
    const depositRequest = {
      ...depositDto,
      walletId,
      walletType: wallet.walletType,
    };

    // Use existing solowallet service for the actual deposit
    const result = await this.solowalletService.depositFunds({
      ...depositRequest,
      userId,
    });

    // Update wallet-specific progress/status after successful deposit
    await this.updateWalletProgress(userId, walletId, wallet.walletType);

    return result;
  }

  /**
   * Withdraw funds from a specific wallet
   */
  async withdrawFromWallet(
    userId: string,
    walletId: string,
    withdrawDto: WithdrawFundsRequestDto,
  ) {
    const wallet = await this.findWalletByUserAndId(userId, walletId);
    const balance = await this.getWalletBalance(userId, walletId);

    // Check wallet-specific withdrawal restrictions
    if (
      wallet.walletType === WalletType.LOCKED &&
      this.isWalletLocked(wallet)
    ) {
      throw new BadRequestException(
        'Cannot withdraw from locked wallet before lock expires',
      );
    }

    // Convert fiat to msats for balance check (simplified - in reality would need exchange rate)
    // For now, assume direct comparison with balance (this needs proper implementation)
    if (withdrawDto.amountFiat > balance) {
      throw new BadRequestException('Insufficient balance in wallet');
    }

    // Add wallet context to the withdrawal request
    const withdrawRequest = {
      ...withdrawDto,
      walletId,
      walletType: wallet.walletType,
    };

    // Use existing solowallet service for the actual withdrawal
    const result = await this.solowalletService.withdrawFunds({
      ...withdrawRequest,
      userId,
    });

    // Update wallet-specific progress/status after successful withdrawal
    await this.updateWalletProgress(userId, walletId, wallet.walletType);

    return result;
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(userId: string, walletId: string): Promise<number> {
    const pipeline = [
      { $match: { userId, walletId, status: TransactionStatus.COMPLETE } },
      {
        $group: {
          _id: null,
          balance: {
            $sum: {
              $cond: [
                { $eq: ['$type', TransactionType.DEPOSIT] },
                '$amountMsats',
                { $multiply: ['$amountMsats', -1] },
              ],
            },
          },
        },
      },
    ];

    const result = await this.solowalletRepository.aggregate(pipeline);
    return result.length > 0 ? result[0].balance : 0;
  }

  /**
   * Helper methods
   */
  private async findWalletByUserAndId(
    userId: string,
    walletId: string,
  ): Promise<SolowalletDocument> {
    const wallet = await this.solowalletRepository.findOne({
      userId,
      walletId,
      type: TransactionType.WALLET_CREATION,
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  private calculateLockEndDate(
    lockPeriod: LockPeriod,
    customEndDate?: Date,
  ): Date {
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
  }

  private isWalletLocked(wallet: SolowalletDocument): boolean {
    if (wallet.walletType !== WalletType.LOCKED || !wallet.lockEndDate) {
      return false;
    }
    return new Date() < wallet.lockEndDate;
  }

  private async updateWalletProgress(
    userId: string,
    walletId: string,
    walletType: WalletType,
  ): Promise<void> {
    if (walletType === WalletType.TARGET) {
      const wallet = await this.findWalletByUserAndId(userId, walletId);
      const balance = await this.getWalletBalance(userId, walletId);

      // Use msats target amount as primary, fall back to fiat if needed
      const targetAmount = wallet.targetAmountMsats || wallet.targetAmountFiat;

      if (targetAmount) {
        const progressPercentage = Math.min(
          (balance / targetAmount) * 100,
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

          await this.solowalletRepository.findOneAndUpdate(
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
          await this.solowalletRepository.findOneAndUpdate(
            { userId, walletId, type: TransactionType.WALLET_CREATION },
            { progressPercentage },
          );
        }
      }
    }
  }

  private async buildWalletResponse(
    wallet: SolowalletDocument,
    options: { includeLockInfo?: boolean; includeProgress?: boolean } = {},
  ): Promise<WalletResponseDto> {
    const balance = await this.getWalletBalance(
      wallet.userId,
      wallet.walletId!,
    );

    const response: WalletResponseDto = {
      walletId: wallet.walletId!,
      userId: wallet.userId,
      walletType: wallet.walletType || WalletType.STANDARD,
      walletName: wallet.walletName,
      balance,
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
        currentAmountMsats: balance,
        currentAmountFiat: wallet.amountFiat,
        targetAmountMsats: wallet.targetAmountMsats,
        targetAmountFiat: wallet.targetAmountFiat,
        progressPercentage: wallet.progressPercentage || 0,
        milestoneReached: wallet.milestoneReached || [],
        projectedCompletionDate: this.calculateProjectedCompletion(
          wallet,
          balance,
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
        isLocked: this.isWalletLocked(wallet),
        autoRenew: wallet.autoRenew || false,
        penaltyRate: wallet.penaltyRate || 0,
        canWithdrawEarly: true, // Most implementations allow early withdrawal with penalty
        daysRemaining,
      };
    }

    return response;
  }

  private calculateProjectedCompletion(
    wallet: SolowalletDocument,
    currentBalance: number,
  ): Date | undefined {
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
  }
}
