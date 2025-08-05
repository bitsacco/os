import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import {
  Currency,
  TransactionStatus,
  LnurlType,
  LnurlSubType,
  LnurlTransactionDocument,
  mapToSupportedCurrency,
} from '../../common';
import { FxService } from '../../swap/fx/fx.service';
import { LnurlTransaction } from '../db/lnurl-transaction.schema';

@Injectable()
export class LnurlTransactionService {
  private readonly logger = new Logger(LnurlTransactionService.name);

  constructor(
    @InjectModel(LnurlTransaction.name)
    private transactionModel: Model<LnurlTransactionDocument>,
    private readonly fxService: FxService,
  ) {}

  /**
   * Get current exchange rate - centralized implementation
   */
  async getExchangeRate(
    from: Currency = Currency.BTC,
    to: Currency = Currency.KES,
  ): Promise<number> {
    try {
      const rate = await this.fxService.getExchangeRate(
        mapToSupportedCurrency(from),
        mapToSupportedCurrency(to),
      );
      return rate;
    } catch (error) {
      this.logger.error('Failed to get exchange rate', error);
      throw new Error(
        `Unable to fetch exchange rate from ${from} to ${to}. Please try again later.`,
      );
    }
  }

  /**
   * Create a new LNURL transaction - centralized implementation
   */
  async createTransaction(params: {
    type: LnurlType;
    subType?: LnurlSubType;
    userId: string;
    chamaId?: string;
    amountMsats: number;
    currency?: Currency;
    lnurlData: any;
    reference: string;
  }): Promise<LnurlTransactionDocument> {
    const {
      type,
      subType,
      userId,
      chamaId,
      amountMsats,
      currency = Currency.KES,
      lnurlData,
      reference,
    } = params;

    // Get exchange rate for fiat conversion
    const exchangeRate = await this.getExchangeRate(Currency.BTC, currency);
    const amountFiat = this.msatsToFiat(amountMsats, exchangeRate);

    const transaction = new this.transactionModel({
      type,
      subType,
      status: TransactionStatus.PENDING,
      userId,
      chamaId,
      amountMsats,
      amountFiat,
      currency,
      lnurlData,
      reference,
    });

    return transaction.save();
  }

  /**
   * Update transaction status - centralized implementation
   */
  async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    additionalData?: {
      lightning?: any;
      completedAt?: Date;
      error?: string;
    },
  ): Promise<LnurlTransactionDocument | null> {
    const updateData: any = { status };

    if (additionalData) {
      if (additionalData.lightning) {
        updateData.lightning = additionalData.lightning;
      }
      if (additionalData.completedAt) {
        updateData.completedAt = additionalData.completedAt;
      }
      if (additionalData.error) {
        updateData['lnurlData.error'] = additionalData.error;
      }
    }

    return this.transactionModel
      .findByIdAndUpdate(transactionId, updateData, { new: true })
      .exec();
  }

  /**
   * Find transaction by ID
   */
  async findById(
    transactionId: string,
  ): Promise<LnurlTransactionDocument | null> {
    return this.transactionModel.findById(transactionId).exec();
  }

  /**
   * Find transactions by user
   */
  async findByUser(
    userId: string,
    filters?: {
      type?: LnurlType;
      status?: TransactionStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ transactions: LnurlTransactionDocument[]; total: number }> {
    const query: any = { userId };

    if (filters?.type) {
      query.type = filters.type;
    }
    if (filters?.status) {
      query.status = filters.status;
    }

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .exec(),
      this.transactionModel.countDocuments(query).exec(),
    ]);

    return { transactions, total };
  }

  /**
   * Handle payment timeout
   */
  async handlePaymentTimeout(transactionId: string): Promise<void> {
    await this.updateTransactionStatus(transactionId, TransactionStatus.FAILED);
    this.logger.log(`Payment timeout for transaction ${transactionId}`);
  }

  /**
   * Convert millisatoshis to fiat
   */
  msatsToFiat(amountMsats: number, exchangeRate: number): number {
    const btcAmount = amountMsats / 100000000000; // Convert msats to BTC
    return parseFloat((btcAmount * exchangeRate).toFixed(2));
  }

  /**
   * Convert fiat to millisatoshis
   */
  fiatToMsats(amountFiat: number, exchangeRate: number): number {
    const btcAmount = amountFiat / exchangeRate;
    return Math.round(btcAmount * 100000000000); // Convert BTC to msats
  }

  /**
   * Find transaction by custom query
   */
  async findOne(query: any): Promise<LnurlTransactionDocument | null> {
    return this.transactionModel.findOne(query).exec();
  }

  /**
   * Update transaction by custom query
   */
  async updateOne(query: any, update: any): Promise<any> {
    return this.transactionModel.updateOne(query, update).exec();
  }

  /**
   * Get transaction statistics for a user
   */
  async getTransactionStats(
    userId: string,
    type?: LnurlType,
    dateRange?: {
      startDate: Date;
      endDate?: Date;
    },
  ): Promise<{
    totalReceived: number;
    totalSent: number;
    count: number;
  }> {
    const matchQuery: any = {
      userId,
      status: TransactionStatus.COMPLETE,
    };

    if (type) {
      matchQuery.type = type;
    }

    // Add date range filtering
    if (dateRange) {
      matchQuery.createdAt = {};
      if (dateRange.startDate) {
        matchQuery.createdAt.$gte = dateRange.startDate;
      }
      if (dateRange.endDate) {
        matchQuery.createdAt.$lte = dateRange.endDate;
      }
    }

    const stats = await this.transactionModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amountMsats' },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalReceived = 0;
    let totalSent = 0;
    let count = 0;

    stats.forEach((stat) => {
      count += stat.count;
      if (stat._id === LnurlType.PAY_IN) {
        totalReceived += stat.totalAmount;
      } else if (
        stat._id === LnurlType.PAY_OUT ||
        stat._id === LnurlType.WITHDRAW
      ) {
        totalSent += stat.totalAmount;
      }
    });

    return { totalReceived, totalSent, count };
  }

  /**
   * Find transactions by Lightning Address ID
   */
  async findByAddress(
    addressId: string,
    filters?: {
      type?: LnurlType;
      status?: TransactionStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ transactions: LnurlTransactionDocument[]; total: number }> {
    const query: any = { 'lnurlData.addressId': addressId };

    if (filters?.type) {
      query.type = filters.type;
    }
    if (filters?.status) {
      query.status = filters.status;
    }

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .exec(),
      this.transactionModel.countDocuments(query).exec(),
    ]);

    return { transactions, total };
  }
}
