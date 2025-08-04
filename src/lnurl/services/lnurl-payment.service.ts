import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SolowalletService } from '../../solowallet/solowallet.service';
import {
  LnurlType,
  LnurlSubType,
  PaymentResult,
  isLightningAddress,
  TransactionStatus,
  FedimintService,
  LnurlTransactionDocument as LnurlTransactionInterface,
} from '../../common';
import type {
  ExternalTargetInfo,
  ExternalTargetPreferences,
} from '../../common';
import { ExternalLnurlTarget, ExternalLnurlTargetDocument } from '../db';
import { LnurlMetricsService } from '../lnurl.metrics';
import { LnurlResolverService } from './lnurl-resolver.service';
import { LnurlCommonService } from './lnurl-common.service';
import { LnurlTransactionService } from './lnurl-transaction.service';

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

export interface DelegatedPaymentOptions {
  userId: string;
  walletType: 'solo';
  lightningAddress: string;
  amountSats: number;
  comment?: string;
  reference: string;
  idempotencyKey?: string;
}

@Injectable()
export class LnurlPaymentService {
  private readonly logger = new Logger(LnurlPaymentService.name);
  private readonly defaultPaymentTimeout = 30000; // 30 seconds

  constructor(
    @InjectModel(ExternalLnurlTarget.name)
    private readonly externalTargetModel: Model<ExternalLnurlTargetDocument>,
    private readonly lnurlResolverService: LnurlResolverService,
    private readonly lnurlCommonService: LnurlCommonService,
    private readonly lnurlTransactionService: LnurlTransactionService,
    private readonly lnurlMetricsService: LnurlMetricsService,
    private readonly fedimintService: FedimintService,
    private readonly solowalletService: SolowalletService,
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Pay to an external Lightning Address or LNURL
   */
  async payExternal(options: DelegatedPaymentOptions): Promise<{
    success: boolean;
    txId: string;
    message: string;
    error?: string;
  }> {
    this.logger.log(
      `Processing external payment from ${options.userId} to ${options.lightningAddress}`,
    );

    try {
      // Step 1: Validate wallet type
      if (options.walletType !== 'solo') {
        throw new BadRequestException('Unsupported wallet type');
      }

      // Step 2: Prepare the payment (resolve address and get invoice)
      const { invoice } = await this.prepareExternalPayment(
        options.lightningAddress,
        options.amountSats,
        options.comment,
      );

      // Step 3: Convert sats to fiat for wallet service
      const exchangeRate = await this.lnurlTransactionService.getExchangeRate();
      const amountMsats = options.amountSats * 1000;
      const amountFiat = this.lnurlTransactionService.msatsToFiat(
        amountMsats,
        exchangeRate,
      );

      // Step 4: Delegate to wallet (we've already validated it's 'solo')
      // Include the Lightning address in the reference
      const reference =
        options.reference || `Payment to ${options.lightningAddress}`;

      // Call solowallet withdrawal with the invoice
      const result = await this.solowalletService.withdrawFunds({
        userId: options.userId,
        amountFiat,
        reference,
        lightning: { invoice },
        idempotencyKey: options.idempotencyKey,
      });

      return {
        success: true,
        txId: result.txId,
        message: 'Payment initiated successfully',
      };
    } catch (error) {
      this.logger.error(`External payment failed: ${error.message}`);

      // Re-throw HTTP exceptions (including BadRequestException)
      if (error instanceof HttpException) {
        throw error;
      }

      // For non-HTTP errors, return error response
      return {
        success: false,
        txId: '',
        message: 'Payment failed',
        error: error.message,
      };
    }
  }

  /**
   * Prepare external payment by resolving address and fetching invoice
   * This is used by wallet services that need just the invoice
   */
  async prepareExternalPayment(
    target: string,
    amountSats: number,
    comment?: string,
  ): Promise<{ invoice: string; metadata: any }> {
    this.logger.log(
      `Preparing external payment to ${target} for ${amountSats} sats`,
    );

    // Resolve the target
    const resolved = await this.lnurlResolverService.resolve(target);

    if (resolved.type !== 'pay') {
      throw new BadRequestException('Target does not support payments');
    }

    // Convert sats to millisats
    const amountMsats = amountSats * 1000;

    // Validate amount
    const metadata = resolved.metadata;
    if (
      !this.lnurlCommonService.validateAmount(
        amountMsats,
        metadata.minSendable,
        metadata.maxSendable,
      )
    ) {
      const minSats = Math.floor(metadata.minSendable / 1000);
      const maxSats = Math.floor(metadata.maxSendable / 1000);
      throw new BadRequestException(
        `Amount must be between ${minSats} and ${maxSats} sats. You requested ${amountSats} sats.`,
      );
    }

    // Check comment length if provided
    if (comment && metadata.commentAllowed) {
      if (comment.length > metadata.commentAllowed) {
        throw new BadRequestException(
          `Comment too long. Maximum ${metadata.commentAllowed} characters allowed`,
        );
      }
    }

    // Request invoice from external service
    const invoice = await this.requestInvoice(
      metadata.callback,
      amountMsats,
      comment,
    );

    return {
      invoice: invoice.pr,
      metadata: invoice,
    };
  }

  /**
   * Pay to an external Lightning Address or LNURL (Legacy - for backward compatibility)
   */
  private async payExternalLegacy(
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
        const minSats = Math.floor(metadata.minSendable / 1000);
        const maxSats = Math.floor(metadata.maxSendable / 1000);
        throw new BadRequestException(
          `Amount must be between ${metadata.minSendable} and ${metadata.maxSendable} millisatoshis (${minSats} to ${maxSats} sats). You requested ${options.amountMsats} millisatoshis.`,
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
    this.logger.log(
      `Requesting invoice from ${callback} with amount ${amountMsats} msats`,
    );

    // Build callback URL with parameters
    const url = new URL(callback);
    url.searchParams.append('amount', amountMsats.toString());

    if (comment) {
      url.searchParams.append('comment', comment);
    }

    if (payerData) {
      url.searchParams.append('payerdata', JSON.stringify(payerData));
    }

    this.logger.log(`Making request to: ${url.toString()}`);

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

      this.logger.error(
        `Failed to request invoice: ${error.message}. Status: ${error.response?.status}. Response data: ${JSON.stringify(error.response?.data || 'No response data')}`,
      );
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
  ): Promise<LnurlTransactionInterface> {
    const transaction = await this.lnurlTransactionService.createTransaction({
      type: LnurlType.PAY_OUT,
      subType: LnurlSubType.EXTERNAL_PAY,
      userId,
      amountMsats,
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
      reference: `Payment to ${target}`,
    });

    // Update with lightning details
    await this.lnurlTransactionService.updateTransactionStatus(
      transaction._id.toString(),
      TransactionStatus.PENDING,
      {
        lightning: {
          invoice: invoice.pr,
        },
      },
    );

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
    // Get amount in fiat for withdrawal
    const exchangeRate = await this.lnurlTransactionService.getExchangeRate();
    const amountFiat = this.lnurlTransactionService.msatsToFiat(
      amountMsats,
      exchangeRate,
    );

    try {
      // Withdraw funds from user wallet first
      const withdrawalReference = `LNURL payment: ${transactionId}`;
      await this.solowalletService.withdrawFunds({
        userId,
        amountFiat,
        reference: withdrawalReference,
      });

      // Then attempt the payment
      const { operationId } = await this.fedimintService.pay(invoice);

      // Update transaction status
      await this.lnurlTransactionService.updateTransactionStatus(
        transactionId,
        TransactionStatus.COMPLETE,
        {
          completedAt: new Date(),
          lightning: {
            operationId,
          },
        },
      );

      return {
        success: true,
        paymentId: transactionId,
      };
    } catch (error) {
      // Update transaction as failed
      await this.lnurlTransactionService.updateTransactionStatus(
        transactionId,
        TransactionStatus.FAILED,
        {
          completedAt: new Date(),
          error: error.message,
        },
      );

      this.logger.error(
        `Payment failed for transaction ${transactionId}: ${error.message}`,
      );

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
  private async getUserPaymentLimits(
    _userId: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<PaymentLimit> {
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

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const stats = await this.lnurlTransactionService.getTransactionStats(
      userId,
      LnurlType.PAY_OUT,
      {
        startDate: startOfDay,
        endDate: endOfDay,
      },
    );

    return stats.totalSent;
  }

  /**
   * Get monthly payment total
   */
  private async getMonthlyPaymentTotal(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0); // Last day of current month
    endOfMonth.setHours(23, 59, 59, 999);

    const stats = await this.lnurlTransactionService.getTransactionStats(
      userId,
      LnurlType.PAY_OUT,
      {
        startDate: startOfMonth,
        endDate: endOfMonth,
      },
    );

    return stats.totalSent;
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
    payments: LnurlTransactionInterface[];
    total: number;
  }> {
    // Get payments using transaction service
    const result = await this.lnurlTransactionService.findByUser(userId, {
      type: LnurlType.PAY_OUT,
      limit: options?.limit,
      offset: options?.offset,
    });

    // If targetId is specified, filter the results
    if (options?.targetId) {
      const target = await this.externalTargetModel.findById(options.targetId);
      if (target) {
        const filteredPayments = result.transactions.filter((payment) => {
          const externalPay = payment.lnurlData?.externalPay;
          return (
            externalPay?.targetAddress === target.target.address ||
            externalPay?.targetUrl === target.target.lnurl
          );
        });
        return {
          payments: filteredPayments,
          total: filteredPayments.length,
        };
      }
    }

    return {
      payments: result.transactions,
      total: result.total,
    };
  }
}
