import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  WalletType,
  LockPeriod,
  TransactionType,
  TransactionStatus,
} from '../../common';
import {
  CreateLockDto,
  UpdateLockDto,
  EarlyWithdrawRequestDto,
  LockStatusResponseDto,
  EarlyWithdrawResponseDto,
} from '../dto';
import { SolowalletRepository, SolowalletDocument } from '../db';
import { PersonalWalletService } from './wallet.service';

@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);

  constructor(
    private readonly solowalletRepository: SolowalletRepository,
    private readonly personalWalletService: PersonalWalletService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('LockService initialized');
  }

  /**
   * Create lock for a standard wallet (converts it to locked wallet)
   */
  async createLock(
    userId: string,
    walletId: string,
    createLockDto: CreateLockDto,
  ): Promise<LockStatusResponseDto> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (wallet.walletType === WalletType.TARGET) {
      throw new BadRequestException('Cannot lock a target wallet');
    }

    if (wallet.walletType === WalletType.LOCKED) {
      throw new ConflictException('Wallet is already locked');
    }

    const { currentBalance: balance } =
      await this.personalWalletService.getWalletMeta(userId, walletId);

    if (balance === 0) {
      throw new BadRequestException('Cannot lock wallet with zero balance');
    }

    const lockEndDate = this.calculateLockEndDate(
      createLockDto.lockPeriod,
      createLockDto.lockEndDate,
    );

    // Update wallet to locked type with lock configuration
    await this.solowalletRepository.findOneAndUpdate(
      { userId, walletId, type: TransactionType.WALLET_CREATION },
      {
        walletType: WalletType.LOCKED,
        lockPeriod: createLockDto.lockPeriod,
        lockEndDate,
        autoRenew: createLockDto.autoRenew || false,
        penaltyRate: createLockDto.penaltyRate || 10,
      },
    );

    // Emit lock creation event
    this.eventEmitter.emit('wallet.locked', {
      userId,
      walletId,
      lockPeriod: createLockDto.lockPeriod,
      lockEndDate,
      balance,
      lockedAt: new Date(),
    });

    this.logger.log(
      `Created lock for wallet ${walletId} until ${lockEndDate.toISOString()}`,
    );

    return this.buildLockStatusResponse(userId, walletId, balance);
  }

  /**
   * Update lock settings
   */
  async updateLock(
    userId: string,
    walletId: string,
    updateLockDto: UpdateLockDto,
  ): Promise<LockStatusResponseDto> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (wallet.walletType !== WalletType.LOCKED) {
      throw new BadRequestException('Wallet is not locked');
    }

    const updateData: any = {};

    if (updateLockDto.autoRenew !== undefined) {
      updateData.autoRenew = updateLockDto.autoRenew;
    }

    if (updateLockDto.penaltyRate !== undefined) {
      updateData.penaltyRate = updateLockDto.penaltyRate;
    }

    await this.solowalletRepository.findOneAndUpdate(
      { userId, walletId, type: TransactionType.WALLET_CREATION },
      updateData,
    );

    const { currentBalance: balance } =
      await this.personalWalletService.getWalletMeta(userId, walletId);

    this.logger.log(`Updated lock settings for wallet ${walletId}`);

    return this.buildLockStatusResponse(userId, walletId, balance);
  }

  /**
   * Perform early withdrawal with penalty
   */
  async performEarlyWithdrawal(
    userId: string,
    walletId: string,
    earlyWithdrawDto: EarlyWithdrawRequestDto,
  ): Promise<EarlyWithdrawResponseDto> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (wallet.walletType !== WalletType.LOCKED) {
      throw new BadRequestException('Wallet is not locked');
    }

    if (!this.isWalletLocked(wallet)) {
      throw new BadRequestException('Wallet lock has already expired');
    }

    if (!earlyWithdrawDto.acceptPenalty) {
      throw new BadRequestException('Must accept penalty for early withdrawal');
    }

    const { currentBalance: balance } =
      await this.personalWalletService.getWalletMeta(userId, walletId);

    if (earlyWithdrawDto.amount > balance) {
      throw new BadRequestException('Insufficient balance for withdrawal');
    }

    const penaltyRate = wallet.penaltyRate || 10;
    const penaltyAmount = Math.floor(
      (earlyWithdrawDto.amount * penaltyRate) / 100,
    );
    const netAmount = earlyWithdrawDto.amount - penaltyAmount;

    // Create withdrawal transaction with penalty
    const withdrawalTx = await this.solowalletRepository.create({
      userId,
      walletId,
      amountMsats: -earlyWithdrawDto.amount,
      type: TransactionType.WITHDRAW,
      status: TransactionStatus.COMPLETE,
      lightning: '',
      paymentTracker: '',
      reference: `early_withdrawal_${walletId}_${Date.now()}`,
      notes: `Early withdrawal with ${penaltyRate}% penalty`,
      __v: 0,
    });

    // Create penalty transaction (goes to system/fees)
    await this.solowalletRepository.create({
      userId,
      walletId,
      amountMsats: -penaltyAmount,
      type: TransactionType.WITHDRAW,
      status: TransactionStatus.COMPLETE,
      lightning: '',
      paymentTracker: '',
      reference: `penalty_${walletId}_${Date.now()}`,
      notes: `Early withdrawal penalty (${penaltyRate}%)`,
      __v: 0,
    });

    const remainingBalance = balance - earlyWithdrawDto.amount;

    // Emit early withdrawal event
    this.eventEmitter.emit('wallet.earlyWithdrawal', {
      userId,
      walletId,
      withdrawnAmount: earlyWithdrawDto.amount,
      penaltyAmount,
      netAmount,
      remainingBalance,
      withdrawnAt: new Date(),
    });

    this.logger.log(
      `Early withdrawal from wallet ${walletId}: ${earlyWithdrawDto.amount} msats with ${penaltyAmount} msats penalty`,
    );

    return {
      withdrawnAmount: earlyWithdrawDto.amount,
      penaltyAmount,
      netAmount,
      remainingBalance,
      transactionReference: withdrawalTx.reference,
    };
  }

  /**
   * Unlock wallet when lock period expires
   */
  async unlockWallet(userId: string, walletId: string): Promise<void> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (wallet.walletType !== WalletType.LOCKED) {
      throw new BadRequestException('Wallet is not locked');
    }

    if (this.isWalletLocked(wallet)) {
      throw new BadRequestException('Wallet lock has not yet expired');
    }

    // Check if auto-renewal is enabled
    if (wallet.autoRenew) {
      const newLockEndDate = this.calculateLockEndDate(
        wallet.lockPeriod!,
        undefined,
        wallet.lockEndDate,
      );

      await this.solowalletRepository.findOneAndUpdate(
        { userId, walletId, type: TransactionType.WALLET_CREATION },
        {
          lockEndDate: newLockEndDate,
        },
      );

      // Emit auto-renewal event
      this.eventEmitter.emit('wallet.autoRenewed', {
        userId,
        walletId,
        newLockEndDate,
        renewedAt: new Date(),
      });

      this.logger.log(
        `Auto-renewed lock for wallet ${walletId} until ${newLockEndDate.toISOString()}`,
      );
    } else {
      // Convert back to standard wallet
      await this.solowalletRepository.findOneAndUpdate(
        { userId, walletId, type: TransactionType.WALLET_CREATION },
        {
          walletType: WalletType.STANDARD,
          $unset: {
            lockPeriod: '',
            lockEndDate: '',
            autoRenew: '',
            penaltyRate: '',
          },
        },
      );

      // Emit unlock event
      this.eventEmitter.emit('wallet.unlocked', {
        userId,
        walletId,
        unlockedAt: new Date(),
      });

      this.logger.log(`Unlocked wallet ${walletId}`);
    }
  }

  /**
   * Get lock status
   */
  async getLockStatus(
    userId: string,
    walletId: string,
  ): Promise<LockStatusResponseDto> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (wallet.walletType !== WalletType.LOCKED) {
      throw new BadRequestException('Wallet is not locked');
    }

    const { currentBalance: balance } =
      await this.personalWalletService.getWalletMeta(userId, walletId);

    return this.buildLockStatusResponse(userId, walletId, balance);
  }

  /**
   * Get all locked wallets for user
   */
  async getUserLockedWallets(userId: string): Promise<LockStatusResponseDto[]> {
    const lockedWallets = await this.solowalletRepository.find({
      userId,
      walletType: WalletType.LOCKED,
      type: TransactionType.WALLET_CREATION,
    });

    const lockStatuses = await Promise.all(
      lockedWallets.map(async (wallet) => {
        const { currentBalance: balance } =
          await this.personalWalletService.getWalletMeta(
            userId,
            wallet.walletId!,
          );
        return this.buildLockStatusResponse(userId, wallet.walletId!, balance);
      }),
    );

    return lockStatuses;
  }

  /**
   * Cron job to process expired locks and calculate interest
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processExpiredLocks(): Promise<void> {
    this.logger.log('Processing expired locks and calculating interest');

    const expiredLocks = await this.solowalletRepository.find({
      walletType: WalletType.LOCKED,
      type: TransactionType.WALLET_CREATION,
      lockEndDate: { $lte: new Date() },
    });

    for (const wallet of expiredLocks) {
      try {
        await this.unlockWallet(wallet.userId, wallet.walletId!);
      } catch (error) {
        this.logger.error(
          `Failed to process expired lock for wallet ${wallet.walletId}:`,
          error,
        );
      }
    }
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
    fromDate?: Date,
  ): Date {
    if (lockPeriod === LockPeriod.CUSTOM && customEndDate) {
      return customEndDate;
    }

    const baseDate = fromDate || new Date();
    const startDate = new Date(baseDate);

    switch (lockPeriod) {
      case LockPeriod.ONE_MONTH:
        return new Date(startDate.setMonth(startDate.getMonth() + 1));
      case LockPeriod.THREE_MONTHS:
        return new Date(startDate.setMonth(startDate.getMonth() + 3));
      case LockPeriod.SIX_MONTHS:
        return new Date(startDate.setMonth(startDate.getMonth() + 6));
      case LockPeriod.ONE_YEAR:
        return new Date(startDate.setFullYear(startDate.getFullYear() + 1));
      default:
        throw new BadRequestException('Invalid lock period');
    }
  }

  private isWalletLocked(wallet: SolowalletDocument): boolean {
    if (!wallet.lockEndDate) return false;
    return new Date() < wallet.lockEndDate;
  }

  private async buildLockStatusResponse(
    userId: string,
    walletId: string,
    balance: number,
  ): Promise<LockStatusResponseDto> {
    const wallet = await this.findWalletByUserAndId(userId, walletId);

    if (!wallet.lockEndDate || !wallet.lockPeriod) {
      throw new BadRequestException('Invalid lock configuration');
    }

    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (wallet.lockEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
    const isLocked = this.isWalletLocked(wallet);
    const penaltyRate = wallet.penaltyRate || 0;
    const earlyWithdrawalPenalty = isLocked
      ? Math.floor((balance * penaltyRate) / 100)
      : undefined;

    return {
      isLocked,
      lockPeriod: wallet.lockPeriod,
      lockEndDate: wallet.lockEndDate,
      daysRemaining,
      autoRenew: wallet.autoRenew || false,
      penaltyRate,
      canWithdrawEarly: isLocked, // Can withdraw early if locked (with penalty)
      earlyWithdrawalPenalty,
    };
  }
}
