import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LnurlTransaction,
  LnurlTransactionDocument,
} from '../schemas/lnurl-transaction.schema';
import { LnurlCommonService } from './lnurl-common.service';
import { FedimintService } from '../../common/fedimint/fedimint.service';
import { FxService } from '../../swap/fx/fx.service';
import {
  LnurlType,
  LnurlSubType,
  WithdrawOptions,
  WithdrawLink,
  LnurlWithdrawResponse,
  LnurlWithdrawCallbackResponse,
} from '../types';
import { TransactionStatus, Currency } from '../../common/types';
import { mapToSupportedCurrency } from '../../common/utils';

@Injectable()
export class LnurlWithdrawService {
  private readonly logger = new Logger(LnurlWithdrawService.name);

  constructor(
    @InjectModel(LnurlTransaction.name)
    private readonly lnurlTransactionModel: Model<LnurlTransactionDocument>,
    private readonly lnurlCommonService: LnurlCommonService,
    private readonly fedimintService: FedimintService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly fxService: FxService,
  ) {}

  /**
   * Create a new LNURL withdrawal link
   */
  async createWithdrawLink(
    userId: string,
    options: WithdrawOptions,
  ): Promise<WithdrawLink> {
    this.logger.log(`Creating withdrawal link for user ${userId}`);

    // Generate unique k1
    const k1 = this.lnurlCommonService.generateK1();

    // Calculate expiry
    const expiryMinutes = options.expiryMinutes || 60;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Determine min/max withdrawable
    const minWithdrawable =
      options.minWithdrawable || Math.min(1000, options.amountMsats);
    const maxWithdrawable = options.maxWithdrawable || options.amountMsats;

    // Get callback URL
    const callback = this.lnurlCommonService.getCallbackUrl(
      '/v1/lnurl/withdraw/callback',
    );

    // Create LNURL withdraw point data
    const withdrawData = {
      k1,
      callback,
      minWithdrawable,
      maxWithdrawable,
      defaultDescription: options.description || 'Bitsacco LNURL Withdrawal',
      expiresAt,
    };

    // Create transaction record
    const exchangeRate = await this.getExchangeRate();
    const transaction = new this.lnurlTransactionModel({
      type: LnurlType.WITHDRAW,
      subType: options.singleUse
        ? LnurlSubType.LINK_WITHDRAW
        : LnurlSubType.QR_WITHDRAW,
      status: TransactionStatus.PENDING,
      userId,
      amountMsats: options.amountMsats,
      amountFiat: this.lnurlCommonService.msatsToFiat(
        options.amountMsats,
        exchangeRate,
      ),
      currency: Currency.KES,
      lnurlData: {
        withdraw: withdrawData,
      },
      lightning: {},
      reference: options.description || 'LNURL Withdrawal',
    });

    await transaction.save();

    // Generate LNURL
    const withdrawUrl = `${callback}?k1=${k1}`;
    const lnurl = this.lnurlCommonService.encodeLnurl(withdrawUrl);

    // Generate QR code
    const qrCode = await this.lnurlCommonService.generateQrCode(lnurl, {
      size: 512,
      margin: 4,
    });

    this.logger.log(`Withdrawal link created with k1: ${k1}`);

    return {
      withdrawId: transaction._id.toString(),
      lnurl,
      qrCode,
      k1,
      expiresAt,
      minWithdrawable,
      maxWithdrawable,
    };
  }

  /**
   * Handle LNURL-withdraw callback (first step - wallet querying)
   */
  async handleWithdrawQuery(k1: string): Promise<LnurlWithdrawResponse> {
    this.logger.log(`Handling withdrawal query for k1: ${k1}`);

    // Find the withdrawal transaction
    const transaction = await this.findPendingWithdrawal(k1);
    if (!transaction) {
      throw new NotFoundException('Withdrawal request not found or expired');
    }

    const withdrawData = transaction.lnurlData.withdraw;
    if (!withdrawData) {
      throw new BadRequestException('Invalid withdrawal data');
    }

    // Check if expired
    if (new Date() > new Date(withdrawData.expiresAt)) {
      await this.updateTransactionStatus(
        transaction._id,
        TransactionStatus.FAILED,
      );
      throw new BadRequestException('Withdrawal request expired');
    }

    return {
      callback: withdrawData.callback,
      k1: withdrawData.k1,
      minWithdrawable: withdrawData.minWithdrawable,
      maxWithdrawable: withdrawData.maxWithdrawable,
      defaultDescription: withdrawData.defaultDescription,
      tag: 'withdrawRequest',
    };
  }

  /**
   * Process LNURL-withdraw callback (second step - actual withdrawal)
   */
  async processWithdrawCallback(
    k1: string,
    pr: string,
  ): Promise<LnurlWithdrawCallbackResponse> {
    this.logger.log(`Processing withdrawal callback for k1: ${k1}`);

    const startTime = Date.now();

    try {
      // Find the withdrawal transaction
      const transaction = await this.findPendingWithdrawal(k1);
      if (!transaction) {
        return {
          status: 'ERROR',
          reason: 'Withdrawal request not found',
        };
      }

      const withdrawData = transaction.lnurlData.withdraw;
      if (!withdrawData) {
        return {
          status: 'ERROR',
          reason: 'Invalid withdrawal data',
        };
      }

      // Check if expired
      if (new Date() > new Date(withdrawData.expiresAt)) {
        await this.updateTransactionStatus(
          transaction._id,
          TransactionStatus.FAILED,
        );
        return {
          status: 'ERROR',
          reason: 'Withdrawal request expired',
        };
      }

      // Check if already claimed (for single-use links)
      if (withdrawData.claimedAt) {
        return {
          status: 'ERROR',
          reason: 'Withdrawal already claimed',
        };
      }

      // Update to processing status
      await this.updateTransactionStatus(
        transaction._id,
        TransactionStatus.PROCESSING,
      );

      // Pay the invoice using Fedimint
      const { operationId } = await this.fedimintService.pay(pr);

      // Update transaction with success
      const updatedTransaction =
        await this.lnurlTransactionModel.findByIdAndUpdate(
          transaction._id,
          {
            status: TransactionStatus.COMPLETE,
            completedAt: new Date(),
            'lightning.invoice': pr,
            'lightning.operationId': operationId,
            'lnurlData.withdraw.claimedAt': new Date(),
            'lnurlData.withdraw.claimingWallet': 'External wallet', // Could extract from invoice
          },
          { new: true },
        );

      // Emit success event
      this.eventEmitter.emit('lnurl.withdraw.completed', {
        transactionId: transaction._id,
        userId: transaction.userId,
        amountMsats: transaction.amountMsats,
        duration: Date.now() - startTime,
      });

      this.logger.log(
        `Withdrawal completed for transaction ${transaction._id}`,
      );

      return {
        status: 'OK',
      };
    } catch (error) {
      this.logger.error(`Failed to process withdrawal: ${error.message}`);

      // Try to update transaction status to failed
      const transaction = await this.findPendingWithdrawal(k1);
      if (transaction) {
        await this.updateTransactionStatus(
          transaction._id,
          TransactionStatus.FAILED,
        );
      }

      // Emit failure event
      this.eventEmitter.emit('lnurl.withdraw.failed', {
        k1,
        error: error.message,
        duration: Date.now() - startTime,
      });

      return {
        status: 'ERROR',
        reason: error.message || 'Failed to process withdrawal',
      };
    }
  }

  /**
   * Find a pending withdrawal by k1
   */
  private async findPendingWithdrawal(
    k1: string,
  ): Promise<LnurlTransactionDocument | null> {
    return this.lnurlTransactionModel.findOne({
      type: LnurlType.WITHDRAW,
      status: {
        $in: [TransactionStatus.PENDING, TransactionStatus.PROCESSING],
      },
      'lnurlData.withdraw.k1': k1,
    });
  }

  /**
   * Update transaction status
   */
  private async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
  ): Promise<void> {
    await this.lnurlTransactionModel.updateOne(
      { _id: transactionId },
      {
        status,
        updatedAt: new Date(),
      },
    );
  }

  /**
   * Get exchange rate from FxService
   */
  private async getExchangeRate(): Promise<number> {
    try {
      // Get BTC to KES exchange rate
      const rate = await this.fxService.getExchangeRate(
        mapToSupportedCurrency(Currency.BTC),
        mapToSupportedCurrency(Currency.KES),
      );
      return rate;
    } catch (error) {
      this.logger.error(`Failed to get exchange rate: ${error.message}`);
      throw new Error(
        'Unable to fetch current exchange rate. Please try again later.',
      );
    }
  }

  /**
   * Cancel a withdrawal link
   */
  async cancelWithdrawal(withdrawId: string, userId: string): Promise<void> {
    const transaction = await this.lnurlTransactionModel.findOne({
      _id: withdrawId,
      userId,
      type: LnurlType.WITHDRAW,
      status: TransactionStatus.PENDING,
    });

    if (!transaction) {
      throw new NotFoundException('Withdrawal not found or already processed');
    }

    await this.updateTransactionStatus(withdrawId, TransactionStatus.FAILED);

    this.logger.log(`Withdrawal ${withdrawId} cancelled by user ${userId}`);
  }

  /**
   * List user's withdrawals
   */
  async listWithdrawals(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{
    withdrawals: LnurlTransactionDocument[];
    total: number;
  }> {
    const query = {
      userId,
      type: LnurlType.WITHDRAW,
    };

    const [withdrawals, total] = await Promise.all([
      this.lnurlTransactionModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset),
      this.lnurlTransactionModel.countDocuments(query),
    ]);

    return { withdrawals, total };
  }

  /**
   * Get withdrawal status
   */
  async getWithdrawalStatus(
    withdrawId: string,
    userId: string,
  ): Promise<LnurlTransactionDocument> {
    const transaction = await this.lnurlTransactionModel.findOne({
      _id: withdrawId,
      userId,
      type: LnurlType.WITHDRAW,
    });

    if (!transaction) {
      throw new NotFoundException('Withdrawal not found');
    }

    return transaction;
  }
}
