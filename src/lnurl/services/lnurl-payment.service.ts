import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { SolowalletService } from '../../solowallet/solowallet.service';
import { ChamaWalletService } from '../../chamawallet/wallet.service';
import {
  LnurlType,
  PaymentResult,
  isLightningAddress,
  LnurlTransactionDocument as LnurlTransactionInterface,
} from '../../common';
import type {
  ExternalTargetInfo,
  ExternalTargetPreferences,
} from '../../common';
import { WalletType } from '../dto';
import { ExternalLnurlTarget, ExternalLnurlTargetDocument } from '../db';
import { LnurlResolverService } from './lnurl-resolver.service';
import { LnurlCommonService } from './lnurl-common.service';
import { LnurlTransactionService } from './lnurl-transaction.service';

export interface ExternalPaymentResult extends PaymentResult {
  targetId?: string;
  domain: string;
  successAction?: any;
}

export interface ExternalPaymentOptions {
  userId: string;
  walletType: WalletType;
  chamaId?: string;
  lightningAddress: string;
  amountSats: number;
  comment?: string;
  reference: string;
  idempotencyKey?: string;
  txId?: string;
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
    private readonly solowalletService: SolowalletService,
    private readonly chamaWalletService: ChamaWalletService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Pay to an external Lightning Address or LNURL
   */
  async payExternal(options: ExternalPaymentOptions): Promise<{
    success: boolean;
    txId: string;
    message: string;
    error?: string;
  }> {
    this.logger.log(
      `Processing external payment from ${options.userId} to ${options.lightningAddress}${
        options.txId ? ` (continuing tx: ${options.txId})` : ''
      }`,
    );

    try {
      // Step 1: Validate wallet type and required fields
      if (options.walletType === WalletType.CHAMA) {
        if (!options.chamaId) {
          throw new BadRequestException(
            'Chama ID is required for chama wallet payments',
          );
        }
        if (!options.txId) {
          throw new BadRequestException(
            'Transaction ID is required for chama withdrawals',
          );
        }
      } else if (options.walletType !== WalletType.SOLO) {
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

      // Step 4: Delegate to appropriate wallet service
      // Include the Lightning address in the reference
      const reference =
        options.reference || `Payment to ${options.lightningAddress}`;

      let result: { txId: string } | { txId?: string };

      if (options.walletType === WalletType.CHAMA) {
        // Handle chamawallet withdrawals
        result = await this.chamaWalletService.continueWithdraw({
          chamaId: options.chamaId!,
          memberId: options.userId,
          txId: options.txId!,
          lightning: { invoice },
        });
      } else {
        // Handle solowallet withdrawals
        if (options.txId) {
          // Continue existing transaction
          result = await this.solowalletService.continueWithdrawFunds({
            userId: options.userId,
            txId: options.txId,
            amountFiat,
            reference,
            lightning: { invoice },
          });
        } else {
          // Create new transaction with server-generated idempotency key
          const idempotencyKey =
            options.idempotencyKey || `lnurl-pay-${randomUUID()}`;
          result = await this.solowalletService.withdrawFunds({
            userId: options.userId,
            amountFiat,
            reference,
            lightning: { invoice },
            idempotencyKey,
          });
        }
      }

      return {
        success: true,
        txId: result.txId,
        message: options.txId
          ? 'Payment continued successfully'
          : 'Payment initiated successfully',
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
