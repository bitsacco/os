import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import {
  ExternalLnurlTarget,
  ExternalLnurlTargetDocument,
} from '../schemas/external-target.schema';
import {
  LnurlTransaction,
  LnurlTransactionDocument,
} from '../schemas/lnurl-transaction.schema';
import { LnurlResolverService } from './lnurl-resolver.service';
import { LnurlCommonService } from './lnurl-common.service';
import { LnurlMetricsService } from '../lnurl.metrics';
import { FedimintService } from '../../common/fedimint/fedimint.service';
import { SolowalletService } from '../../solowallet/solowallet.service';
import { FxService } from '../../swap/fx/fx.service';
import {
  LnurlType,
  LnurlSubType,
  PaymentResult,
  ExternalTargetInfo,
  ExternalTargetPreferences,
  isLightningAddress,
} from '../types';
import { TransactionStatus, Currency } from '../../common/types';
import { mapToSupportedCurrency } from '../../common/utils';

export interface ExternalPaymentOptions {
  amountMsats: number;
  comment?: string;
  payerData?: any;
  saveTarget?: boolean;
  targetNickname?: string;
}

export interface PaymentLimit {
  daily: number;
  monthly: number;
  perTarget: number;
}

export interface ExternalPaymentResult extends PaymentResult {
  targetId?: string;
  domain: string;
  successAction?: any;
}

@Injectable()
export class LnurlPaymentService {
  private readonly logger = new Logger(LnurlPaymentService.name);
  private readonly defaultPaymentTimeout = 30000; // 30 seconds

  constructor(
    @InjectModel(ExternalLnurlTarget.name)
    private readonly externalTargetModel: Model<ExternalLnurlTargetDocument>,
    @InjectModel(LnurlTransaction.name)
    private readonly lnurlTransactionModel: Model<LnurlTransactionDocument>,
    private readonly lnurlResolverService: LnurlResolverService,
    private readonly lnurlCommonService: LnurlCommonService,
    private readonly lnurlMetricsService: LnurlMetricsService,
    private readonly fedimintService: FedimintService,
    private readonly solowalletService: SolowalletService,
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
    private readonly fxService: FxService,
  ) {}

  /**
   * Pay to an external Lightning Address or LNURL
   */
  async payExternal(
    userId: string,
    target: string,
    options: ExternalPaymentOptions,
  ): Promise<ExternalPaymentResult> {
    this.logger.log(
      `Processing external payment to ${target} for user ${userId}`,
    );

    const startTime = Date.now();

    try {
      // Check payment limits
      await this.checkPaymentLimits(userId, options.amountMsats);

      // Resolve the target
      const resolved = await this.lnurlResolverService.resolve(target);

      if (resolved.type !== 'pay') {
        throw new BadRequestException('Target does not support payments');
      }

      // Get or create target record
      let targetRecord: ExternalLnurlTargetDocument | null = null;
      if (options.saveTarget) {
        targetRecord = await this.saveExternalTarget(
          userId,
          target,
          resolved,
          options.targetNickname,
        );
      }

      // Validate amount
      const metadata = resolved.metadata;
      if (
        !this.lnurlCommonService.validateAmount(
          options.amountMsats,
          metadata.minSendable,
          metadata.maxSendable,
        )
      ) {
        throw new BadRequestException(
          `Amount must be between ${metadata.minSendable} and ${metadata.maxSendable} millisatoshis`,
        );
      }

      // Check comment length if provided
      if (options.comment && metadata.commentAllowed) {
        if (options.comment.length > metadata.commentAllowed) {
          throw new BadRequestException(
            `Comment too long. Maximum ${metadata.commentAllowed} characters allowed`,
          );
        }
      }

      // Request invoice from external service
      const invoice = await this.requestInvoice(
        metadata.callback,
        options.amountMsats,
        options.comment,
        options.payerData,
      );

      // Create transaction record
      const transaction = await this.createExternalPaymentTransaction(
        userId,
        target,
        resolved.domain,
        options.amountMsats,
        invoice,
      );

      // Pay the invoice
      const paymentResult = await this.payInvoice(
        userId,
        transaction._id.toString(),
        invoice.pr,
        options.amountMsats,
      );

      // Update target statistics if saved
      if (targetRecord) {
        await this.updateTargetStats(
          targetRecord._id.toString(),
          options.amountMsats,
        );
      }

      // Record metrics
      const duration = Date.now() - startTime;
      this.lnurlMetricsService.recordExternalPayment(
        resolved.domain,
        paymentResult.success ? 'success' : 'failed',
        duration,
        options.amountMsats,
        paymentResult.error,
      );

      return {
        success: paymentResult.success,
        paymentId: transaction._id.toString(),
        preimage: paymentResult.preimage,
        targetId: targetRecord?._id.toString(),
        domain: resolved.domain,
        successAction: invoice.successAction,
        error: paymentResult.error,
      };
    } catch (error) {
      this.logger.error(`External payment failed: ${error.message}`);

      // Record failure metric
      const duration = Date.now() - startTime;
      this.lnurlMetricsService.recordExternalPayment(
        isLightningAddress(target) ? target.split('@')[1] : 'unknown',
        'failed',
        duration,
        undefined,
        error.message,
      );

      throw error;
    }
  }

  /**
   * Request invoice from external LNURL service
   */
  private async requestInvoice(
    callback: string,
    amountMsats: number,
    comment?: string,
    payerData?: any,
  ): Promise<any> {
    this.logger.log(`Requesting invoice from ${callback}`);

    // Build callback URL with parameters
    const url = new URL(callback);
    url.searchParams.append('amount', amountMsats.toString());

    if (comment) {
      url.searchParams.append('comment', comment);
    }

    if (payerData) {
      url.searchParams.append('payerdata', JSON.stringify(payerData));
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(url.toString(), {
          timeout: this.defaultPaymentTimeout,
          headers: {
            'User-Agent': 'Bitsacco-LNURL/1.0',
            Accept: 'application/json',
          },
        }),
      );

      const data = response.data;

      // Check for error response
      if (data.status === 'ERROR') {
        throw new BadRequestException(data.reason || 'External service error');
      }

      // Validate response
      if (!data.pr || typeof data.pr !== 'string') {
        throw new BadRequestException(
          'Invalid invoice response from external service',
        );
      }

      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to request invoice: ${error.message}`);
      throw new HttpException(
        'Failed to get invoice from external service',
        503,
      );
    }
  }

  /**
   * Save or update external target
   */
  async saveExternalTarget(
    userId: string,
    target: string,
    resolved: any,
    nickname?: string,
  ): Promise<ExternalLnurlTargetDocument> {
    const isAddress = isLightningAddress(target);
    const targetInfo: ExternalTargetInfo = {
      address: isAddress ? target : undefined,
      lnurl: !isAddress ? target : undefined,
      domain: resolved.domain,
      metadata: {
        callback: resolved.metadata.callback,
        minSendable: resolved.metadata.minSendable,
        maxSendable: resolved.metadata.maxSendable,
        commentAllowed: resolved.metadata.commentAllowed,
        tag: resolved.metadata.tag,
        metadata: resolved.metadata.metadata,
        cachedAt: new Date(),
        ttl: 3600, // 1 hour
      },
    };

    // Check if target already exists
    const existing = await this.externalTargetModel.findOne({
      userId,
      'target.domain': resolved.domain,
      $or: [{ 'target.address': target }, { 'target.lnurl': target }],
    });

    if (existing) {
      // Update existing target
      existing.target.metadata = targetInfo.metadata;
      existing.updatedAt = new Date();
      if (nickname) {
        existing.preferences.nickname = nickname;
      }
      await existing.save();
      return existing;
    }

    // Create new target
    const newTarget = new this.externalTargetModel({
      userId,
      type: isAddress ? 'LIGHTNING_ADDRESS' : 'LNURL_PAY',
      target: targetInfo,
      stats: {
        totalSent: 0,
        paymentCount: 0,
      },
      preferences: {
        nickname,
        isFavorite: false,
      },
    });

    await newTarget.save();
    return newTarget;
  }

  /**
   * Create external payment transaction
   */
  private async createExternalPaymentTransaction(
    userId: string,
    target: string,
    domain: string,
    amountMsats: number,
    invoice: any,
  ): Promise<LnurlTransactionDocument> {
    const exchangeRate = await this.getExchangeRate();
    const transaction = new this.lnurlTransactionModel({
      type: LnurlType.PAY_OUT,
      subType: LnurlSubType.EXTERNAL_PAY,
      status: TransactionStatus.PENDING,
      userId,
      amountMsats,
      amountFiat: this.lnurlCommonService.msatsToFiat(
        amountMsats,
        exchangeRate,
      ),
      currency: Currency.KES,
      lnurlData: {
        externalPay: {
          targetAddress: isLightningAddress(target) ? target : undefined,
          targetUrl: !isLightningAddress(target) ? target : undefined,
          targetDomain: domain,
          metadata: invoice.metadata,
          comment: invoice.comment,
          successAction: invoice.successAction,
        },
      },
      lightning: {
        invoice: invoice.pr,
      },
      reference: `Payment to ${target}`,
    });

    await transaction.save();
    return transaction;
  }

  /**
   * Pay the invoice
   */
  private async payInvoice(
    userId: string,
    transactionId: string,
    invoice: string,
    amountMsats: number,
  ): Promise<PaymentResult> {
    let fundsWithdrawn = false;
    let withdrawalReference: string;
    const exchangeRate = await this.getExchangeRate();
    const amountFiat = this.lnurlCommonService.msatsToFiat(
      amountMsats,
      exchangeRate,
    );

    try {
      // First, attempt the external payment without withdrawing funds
      const { operationId } = await this.fedimintService.pay(invoice);

      // Only withdraw funds after successful payment
      withdrawalReference = `LNURL payment: ${transactionId}`;
      await this.solowalletService.withdrawFunds({
        userId,
        amountFiat,
        reference: withdrawalReference,
      });
      fundsWithdrawn = true;

      // Update transaction status
      await this.lnurlTransactionModel.findByIdAndUpdate(transactionId, {
        status: TransactionStatus.COMPLETE,
        completedAt: new Date(),
        'lightning.operationId': operationId,
      });

      return {
        success: true,
        paymentId: transactionId,
      };
    } catch (error) {
      // If funds were withdrawn but the transaction update failed, we need to refund
      if (fundsWithdrawn) {
        try {
          this.logger.warn(
            `Payment succeeded but transaction update failed. Refunding user ${userId} for transaction ${transactionId}`,
          );

          // Refund the user
          await this.solowalletService.depositFunds({
            userId,
            amountFiat,
            reference: `Refund for failed LNURL payment: ${transactionId}`,
            onramp: { currency: Currency.KES, origin: undefined },
          });

          this.logger.log(
            `Successfully refunded ${amountFiat} to user ${userId} for failed transaction ${transactionId}`,
          );
        } catch (refundError) {
          // Log critical error - manual intervention needed
          this.logger.error(
            `CRITICAL: Failed to refund user ${userId} after payment failure. Transaction: ${transactionId}, Amount: ${amountFiat}`,
            refundError.stack,
          );

          // Emit event for monitoring/alerting
          this.eventEmitter.emit('critical.refund.failed', {
            userId,
            transactionId,
            amountFiat,
            error: refundError.message,
          });
        }
      }

      // Update transaction as failed
      await this.lnurlTransactionModel.findByIdAndUpdate(transactionId, {
        status: TransactionStatus.FAILED,
        completedAt: new Date(),
        failureReason: error.message,
        refunded: fundsWithdrawn,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check payment limits
   */
  private async checkPaymentLimits(
    userId: string,
    amountMsats: number,
  ): Promise<void> {
    // Get user's payment limits (could be from config or user settings)
    const limits = await this.getUserPaymentLimits(userId);

    // Check daily limit
    const dailyTotal = await this.getDailyPaymentTotal(userId);
    if (dailyTotal + amountMsats > limits.daily) {
      throw new ForbiddenException('Daily payment limit exceeded');
    }

    // Check monthly limit
    const monthlyTotal = await this.getMonthlyPaymentTotal(userId);
    if (monthlyTotal + amountMsats > limits.monthly) {
      throw new ForbiddenException('Monthly payment limit exceeded');
    }
  }

  /**
   * Get user payment limits
   */
  private async getUserPaymentLimits(_userId: string): Promise<PaymentLimit> {
    // TODO: Implement user-specific limits from database
    // For now, return default limits
    return {
      daily: 100000000, // 100k sats
      monthly: 1000000000, // 1M sats
      perTarget: 50000000, // 50k sats per target
    };
  }

  /**
   * Get daily payment total
   */
  private async getDailyPaymentTotal(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await this.lnurlTransactionModel.aggregate([
      {
        $match: {
          userId,
          type: LnurlType.PAY_OUT,
          status: TransactionStatus.COMPLETE,
          createdAt: { $gte: startOfDay },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountMsats' },
        },
      },
    ]);

    return result[0]?.total || 0;
  }

  /**
   * Get monthly payment total
   */
  private async getMonthlyPaymentTotal(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.lnurlTransactionModel.aggregate([
      {
        $match: {
          userId,
          type: LnurlType.PAY_OUT,
          status: TransactionStatus.COMPLETE,
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountMsats' },
        },
      },
    ]);

    return result[0]?.total || 0;
  }

  /**
   * Update target statistics
   */
  private async updateTargetStats(
    targetId: string,
    amountMsats: number,
  ): Promise<void> {
    await this.externalTargetModel.findByIdAndUpdate(targetId, {
      $inc: {
        'stats.totalSent': amountMsats,
        'stats.paymentCount': 1,
      },
      'stats.lastUsedAt': new Date(),
    });
  }

  /**
   * Get user's saved targets
   */
  async getSavedTargets(
    userId: string,
    options?: {
      favorites?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    targets: ExternalLnurlTargetDocument[];
    total: number;
  }> {
    const query: any = { userId };

    if (options?.favorites) {
      query['preferences.isFavorite'] = true;
    }

    const [targets, total] = await Promise.all([
      this.externalTargetModel
        .find(query)
        .sort({ 'stats.lastUsedAt': -1 })
        .limit(options?.limit || 20)
        .skip(options?.offset || 0),
      this.externalTargetModel.countDocuments(query),
    ]);

    return { targets, total };
  }

  /**
   * Update target preferences
   */
  async updateTargetPreferences(
    userId: string,
    targetId: string,
    preferences: Partial<ExternalTargetPreferences>,
  ): Promise<ExternalLnurlTargetDocument> {
    const target = await this.externalTargetModel.findOne({
      _id: targetId,
      userId,
    });

    if (!target) {
      throw new NotFoundException('Target not found');
    }

    Object.assign(target.preferences, preferences);
    target.updatedAt = new Date();
    await target.save();

    return target;
  }

  /**
   * Delete saved target
   */
  async deleteSavedTarget(userId: string, targetId: string): Promise<void> {
    const result = await this.externalTargetModel.deleteOne({
      _id: targetId,
      userId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Target not found');
    }
  }

  /**
   * Get payment history for external payments
   */
  async getExternalPaymentHistory(
    userId: string,
    options?: {
      targetId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    payments: LnurlTransactionDocument[];
    total: number;
  }> {
    const query: any = {
      userId,
      type: LnurlType.PAY_OUT,
    };

    if (options?.targetId) {
      // Find target to get its domain/address
      const target = await this.externalTargetModel.findById(options.targetId);
      if (target) {
        query.$or = [
          { 'lnurlData.externalPay.targetAddress': target.target.address },
          { 'lnurlData.externalPay.targetUrl': target.target.lnurl },
        ];
      }
    }

    const [payments, total] = await Promise.all([
      this.lnurlTransactionModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(options?.limit || 20)
        .skip(options?.offset || 0),
      this.lnurlTransactionModel.countDocuments(query),
    ]);

    return { payments, total };
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
}
