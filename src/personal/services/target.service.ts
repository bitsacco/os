import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { WalletType, TransactionType } from '../../common';
import {
  SetTargetDto,
  UpdateTargetDto,
  TargetProgressResponseDto,
} from '../dto';
import { SolowalletRepository, SolowalletDocument } from '../db';
import { PersonalWalletService } from './wallet.service';

@Injectable()
export class TargetService {
  private readonly logger = new Logger(TargetService.name);

  constructor(
    private readonly solowalletRepository: SolowalletRepository,
    private readonly personalWalletService: PersonalWalletService,
  ) {
    this.logger.log('TargetService initialized');
  }

  /**
   * Set or update target for a standard wallet (converts it to target wallet)
   */
  async setTarget(
    userId: string,
    walletId: string,
    setTargetDto: SetTargetDto,
  ): Promise<TargetProgressResponseDto> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (wallet.walletType === WalletType.LOCKED) {
      throw new BadRequestException('Cannot set target for locked wallet');
    }

    const { currentBalance: balance } =
      await this.personalWalletService.getWalletMeta(userId, walletId);
    // Use msats if provided, otherwise we'll need the fiat amount (validation should ensure one is provided)
    const targetAmountMsats = setTargetDto.targetAmountMsats || 0;
    const targetAmountFiat = setTargetDto.targetAmountFiat;
    const progressPercentage =
      targetAmountMsats > 0
        ? Math.min((balance / targetAmountMsats) * 100, 100)
        : 0;

    // Update wallet to target type with target configuration
    await this.solowalletRepository.findOneAndUpdate(
      { userId, walletId, type: TransactionType.WALLET_CREATION },
      {
        walletType: WalletType.TARGET,
        targetAmountMsats: targetAmountMsats || undefined,
        targetAmountFiat: targetAmountFiat || undefined,
        targetDate: setTargetDto.targetDate,
        progressPercentage,
        milestoneReached: this.calculateInitialMilestones(progressPercentage),
      },
    );

    this.logger.log(
      `Set target for wallet ${walletId}: ${targetAmountMsats} msats, ${targetAmountFiat} fiat`,
    );

    return this.buildProgressResponse(
      userId,
      walletId,
      targetAmountMsats,
      setTargetDto.targetDate,
      balance,
    );
  }

  /**
   * Update existing target
   */
  async updateTarget(
    userId: string,
    walletId: string,
    updateTargetDto: UpdateTargetDto,
  ): Promise<TargetProgressResponseDto> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (wallet.walletType !== WalletType.TARGET) {
      throw new BadRequestException('Wallet is not a target wallet');
    }

    const { currentBalance: balance } =
      await this.personalWalletService.getWalletMeta(userId, walletId);

    // Handle dual-currency target updates
    const newTargetAmountMsats =
      updateTargetDto.targetAmountMsats || wallet.targetAmountMsats || 0;
    const newTargetAmountFiat =
      updateTargetDto.targetAmountFiat || wallet.targetAmountFiat;
    const newTargetDate = updateTargetDto.targetDate || wallet.targetDate;
    const progressPercentage =
      newTargetAmountMsats > 0
        ? Math.min((balance / newTargetAmountMsats) * 100, 100)
        : 0;

    // Check for new milestones if target amount changed
    let updatedMilestones = wallet.milestoneReached || [];
    if (
      updateTargetDto.targetAmountMsats &&
      updateTargetDto.targetAmountMsats !== wallet.targetAmountMsats
    ) {
      const oldProgress = wallet.progressPercentage || 0;
      const newMilestones = this.detectNewMilestones(
        oldProgress,
        progressPercentage,
      );
      if (newMilestones.length > 0) {
        updatedMilestones = [
          ...updatedMilestones,
          ...newMilestones.map(() => new Date()),
        ];
      }
    }

    await this.solowalletRepository.findOneAndUpdate(
      { userId, walletId, type: TransactionType.WALLET_CREATION },
      {
        targetAmountMsats: newTargetAmountMsats || undefined,
        targetAmountFiat: newTargetAmountFiat || undefined,
        targetDate: newTargetDate,
        progressPercentage,
        milestoneReached: updatedMilestones,
      },
    );

    this.logger.log(
      `Updated target for wallet ${walletId}: ${newTargetAmountMsats} msats, ${newTargetAmountFiat} fiat`,
    );

    return this.buildProgressResponse(
      userId,
      walletId,
      newTargetAmountMsats,
      newTargetDate,
      balance,
    );
  }

  /**
   * Remove target (converts back to standard wallet)
   */
  async removeTarget(userId: string, walletId: string): Promise<void> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (wallet.walletType !== WalletType.TARGET) {
      throw new BadRequestException('Wallet is not a target wallet');
    }

    await this.solowalletRepository.findOneAndUpdate(
      { userId, walletId, type: TransactionType.WALLET_CREATION },
      {
        walletType: WalletType.STANDARD,
        $unset: {
          targetAmountMsats: '',
          targetAmountFiat: '',
          targetDate: '',
          progressPercentage: '',
          milestoneReached: '',
        },
      },
    );

    this.logger.log(`Removed target from wallet ${walletId}`);
  }

  /**
   * Get target progress
   */
  async getProgress(
    userId: string,
    walletId: string,
  ): Promise<TargetProgressResponseDto> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (
      wallet.walletType !== WalletType.TARGET ||
      (!wallet.targetAmountMsats && !wallet.targetAmountFiat)
    ) {
      throw new BadRequestException(
        'Wallet is not a target wallet or has no target set',
      );
    }

    const { currentBalance: balance } =
      await this.personalWalletService.getWalletMeta(userId, walletId);

    return this.buildProgressResponse(
      userId,
      walletId,
      wallet.targetAmountMsats || 0,
      wallet.targetDate,
      balance,
    );
  }

  /**
   * Get all target wallets for user with progress
   */
  async getUserTargets(userId: string): Promise<TargetProgressResponseDto[]> {
    const targetWallets = await this.solowalletRepository.find({
      userId,
      walletType: WalletType.TARGET,
      type: TransactionType.WALLET_CREATION,
    });

    const progressData = await Promise.all(
      targetWallets.map(async (wallet) => {
        const { currentBalance: balance } =
          await this.personalWalletService.getWalletMeta(
            userId,
            wallet.walletId!,
          );
        return this.buildProgressResponse(
          userId,
          wallet.walletId!,
          wallet.targetAmountMsats || 0,
          wallet.targetDate,
          balance,
          wallet.milestoneReached,
        );
      }),
    );

    return progressData;
  }

  /**
   * Calculate recommended daily savings to reach target on time
   */
  async getRecommendedDailySavings(
    userId: string,
    walletId: string,
  ): Promise<number> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (
      wallet.walletType !== WalletType.TARGET ||
      (!wallet.targetAmountMsats && !wallet.targetAmountFiat) ||
      !wallet.targetDate
    ) {
      throw new BadRequestException(
        'Wallet must be a target wallet with target date set',
      );
    }

    const { currentBalance: balance } =
      await this.personalWalletService.getWalletMeta(userId, walletId);
    const targetAmount = wallet.targetAmountMsats || 0; // Use msats for calculation
    const remainingAmount = Math.max(0, targetAmount - balance);

    const daysRemaining = Math.max(
      1,
      Math.ceil(
        (wallet.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );

    return Math.ceil(remainingAmount / daysRemaining);
  }

  /**
   * Complete target by marking it as achieved while preserving configuration for historical tracking
   */
  async completeTarget(userId: string, walletId: string): Promise<void> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (wallet.walletType !== WalletType.TARGET) {
      throw new BadRequestException('Wallet is not a target wallet');
    }

    // Mark target as 100% complete and add completion milestone
    const completionDate = new Date();
    const updatedMilestones = [
      ...(wallet.milestoneReached || []),
      completionDate,
    ];

    await this.solowalletRepository.findOneAndUpdate(
      { userId, walletId, type: TransactionType.WALLET_CREATION },
      {
        progressPercentage: 100,
        milestoneReached: updatedMilestones,
        // Keep all target configuration for historical tracking
        // targetAmountMsats, targetAmountFiat, targetDate remain unchanged
        updatedAt: completionDate,
      },
    );

    this.logger.log(
      `Target completed for wallet ${walletId} - configuration preserved for historical tracking`,
    );
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

  private calculateInitialMilestones(progressPercentage: number): Date[] {
    const milestones = [25, 50, 75, 100];
    return milestones
      .filter((milestone) => progressPercentage >= milestone)
      .map(() => new Date());
  }

  private detectNewMilestones(
    oldProgress: number,
    newProgress: number,
  ): number[] {
    const milestones = [25, 50, 75, 100];
    return milestones.filter(
      (milestone) => newProgress >= milestone && oldProgress < milestone,
    );
  }

  private async buildProgressResponse(
    userId: string,
    walletId: string,
    targetAmount: number,
    targetDate?: Date,
    currentAmount?: number,
    milestoneReached?: Date[],
  ): Promise<TargetProgressResponseDto> {
    const balance =
      currentAmount ??
      (await this.personalWalletService.getWalletMeta(userId, walletId))
        .currentBalance;
    const progressPercentage = Math.min((balance / targetAmount) * 100, 100);
    const remainingAmount = Math.max(0, targetAmount - balance);

    let projectedCompletionDate: Date | undefined;
    let daysRemaining: number | undefined;
    let recommendedDailySavings: number | undefined;

    if (targetDate) {
      daysRemaining = Math.max(
        0,
        Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );

      if (daysRemaining > 0 && remainingAmount > 0) {
        recommendedDailySavings = Math.ceil(remainingAmount / daysRemaining);

        // Simple projection: if current rate continues, when will target be reached?
        // For now, use target date as projection (could be enhanced with historical analysis)
        projectedCompletionDate = targetDate;
      } else if (remainingAmount === 0) {
        projectedCompletionDate = new Date(); // Already completed
      }
    }

    return {
      currentAmount: balance,
      targetAmount,
      progressPercentage,
      remainingAmount,
      targetDate,
      projectedCompletionDate,
      daysRemaining,
      milestoneReached: milestoneReached || [],
      recommendedDailySavings,
    };
  }
}
