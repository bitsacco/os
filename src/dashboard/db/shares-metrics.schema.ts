import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  BaseMetrics,
  BaseMetricsDocument,
} from '../../common/database/metrics.schema';

/**
 * Subscription metrics sub-document
 */
@Schema({ _id: false })
export class SubscriptionMetrics {
  @Prop({ type: Number, default: 0 })
  total: number;

  @Prop({ type: Number, default: 0 })
  successful: number;

  @Prop({ type: Number, default: 0 })
  failed: number;

  @Prop({ type: Number, default: 0 })
  successRate: number;

  @Prop({ type: Number, default: 0 })
  averageDuration: number;

  @Prop({ type: Number, default: 0 })
  totalShares: number;

  @Prop({ type: Number, default: 0 })
  totalValue: number;

  @Prop({ type: Number, default: 0 })
  averageSubscriptionSize: number;

  @Prop({ type: Object, default: {} })
  byPaymentMethod: Record<string, number>;
}

/**
 * Transfer metrics sub-document
 */
@Schema({ _id: false })
export class TransferMetrics {
  @Prop({ type: Number, default: 0 })
  total: number;

  @Prop({ type: Number, default: 0 })
  successful: number;

  @Prop({ type: Number, default: 0 })
  failed: number;

  @Prop({ type: Number, default: 0 })
  successRate: number;

  @Prop({ type: Number, default: 0 })
  averageDuration: number;

  @Prop({ type: Number, default: 0 })
  volume: number;

  @Prop({ type: Number, default: 0 })
  averageSize: number;

  @Prop({ type: Number, default: 0 })
  totalShares: number;

  @Prop({ type: Number, default: 0 })
  totalValue: number;

  @Prop({ type: Object, default: {} })
  frequentTransferPairs: Record<string, number>;
}

/**
 * Ownership metrics sub-document
 */
@Schema({ _id: false })
export class OwnershipMetrics {
  @Prop({ type: Number, default: 0 })
  totalShares: number;

  @Prop({ type: Number, default: 0 })
  distributedShares: number;

  @Prop({ type: Number, default: 0 })
  availableShares: number;

  @Prop({ type: Number, default: 0 })
  ownershipConcentration: number;

  @Prop({ type: Number, default: 0 })
  totalShareholders: number;

  @Prop({ type: Number, default: 0 })
  averageSharesPerHolder: number;

  @Prop({ type: Number, default: 0 })
  medianSharesPerHolder: number;

  @Prop({ type: Object, default: {} })
  distributionBuckets: Record<string, number>;

  @Prop({ type: Number, default: 0 })
  giniCoefficient: number;
}

/**
 * Valuation metrics sub-document
 */
@Schema({ _id: false })
export class ValuationMetrics {
  @Prop({ type: Number, default: 0 })
  currentSharePrice: number;

  @Prop({ type: Number, default: 0 })
  marketCapitalization: number;

  @Prop({ type: Number, default: 0 })
  totalAssetValue: number;

  @Prop({ type: Number, default: 0 })
  bookValuePerShare: number;

  @Prop({ type: Number, default: 0 })
  priceToBookRatio: number;

  @Prop({ type: Number, default: 0 })
  dividendYield: number;

  @Prop({ type: Number, default: 0 })
  returnOnEquity: number;

  @Prop({ type: Date })
  lastValuationUpdate: Date;
}

/**
 * Trading activity metrics sub-document
 */
@Schema({ _id: false })
export class TradingActivityMetrics {
  @Prop({ type: Number, default: 0 })
  totalTransactions: number;

  @Prop({ type: Number, default: 0 })
  tradingVolume: number;

  @Prop({ type: Number, default: 0 })
  averageTransactionValue: number;

  @Prop({ type: Number, default: 0 })
  activeTraders: number;

  @Prop({ type: Number, default: 0 })
  velocityRatio: number;

  @Prop({ type: Number, default: 0 })
  turnoverRate: number;

  @Prop({ type: Object, default: {} })
  tradingVolumeByHour: Record<string, number>;

  @Prop({ type: Object, default: {} })
  tradingVolumeByDay: Record<string, number>;
}

/**
 * Error analysis sub-document
 */
@Schema({ _id: false })
export class ErrorAnalysis {
  @Prop({ type: Object, default: {} })
  errorTypes: Record<string, number>;

  @Prop({ type: Number, default: 0 })
  userReachingLimits: number;

  @Prop({ type: Number, default: 0 })
  validationErrors: number;

  @Prop({ type: Number, default: 0 })
  insufficientFundsErrors: number;

  @Prop({ type: Number, default: 0 })
  ownershipLimitErrors: number;

  @Prop({ type: Number, default: 0 })
  systemErrors: number;

  @Prop({ type: Number, default: 0 })
  networkErrors: number;

  @Prop({ type: Object, default: {} })
  errorsByService: Record<string, number>;
}

/**
 * Performance metrics sub-document
 */
@Schema({ _id: false })
export class SharesPerformanceMetrics {
  @Prop({ type: Number, default: 0 })
  averageSubscriptionTime: number;

  @Prop({ type: Number, default: 0 })
  averageTransferTime: number;

  @Prop({ type: Number, default: 0 })
  averageValuationTime: number;

  @Prop({ type: Number, default: 0 })
  p95SubscriptionTime: number;

  @Prop({ type: Number, default: 0 })
  p95TransferTime: number;

  @Prop({ type: Number, default: 0 })
  systemThroughput: number;

  @Prop({ type: Number, default: 0 })
  concurrentOperations: number;

  @Prop({ type: Object, default: {} })
  operationsByType: Record<string, number>;
}

/**
 * Shares metrics document interface
 */
export interface SharesMetricsDocument extends BaseMetricsDocument {
  subscriptions: SubscriptionMetrics;
  transfers: TransferMetrics;
  ownership: OwnershipMetrics;
  valuation: ValuationMetrics;
  tradingActivity: TradingActivityMetrics;
  errorAnalysis: ErrorAnalysis;
  performance: SharesPerformanceMetrics;
}

/**
 * Shares metrics MongoDB schema
 */
@Schema({
  collection: 'shares_metrics',
  timestamps: true,
})
export class SharesMetrics
  extends BaseMetrics
  implements SharesMetricsDocument
{
  @Prop({ type: SubscriptionMetrics, default: () => new SubscriptionMetrics() })
  subscriptions: SubscriptionMetrics;

  @Prop({ type: TransferMetrics, default: () => new TransferMetrics() })
  transfers: TransferMetrics;

  @Prop({ type: OwnershipMetrics, default: () => new OwnershipMetrics() })
  ownership: OwnershipMetrics;

  @Prop({ type: ValuationMetrics, default: () => new ValuationMetrics() })
  valuation: ValuationMetrics;

  @Prop({
    type: TradingActivityMetrics,
    default: () => new TradingActivityMetrics(),
  })
  tradingActivity: TradingActivityMetrics;

  @Prop({ type: ErrorAnalysis, default: () => new ErrorAnalysis() })
  errorAnalysis: ErrorAnalysis;

  @Prop({
    type: SharesPerformanceMetrics,
    default: () => new SharesPerformanceMetrics(),
  })
  performance: SharesPerformanceMetrics;
}

export const SharesMetricsSchema = SchemaFactory.createForClass(SharesMetrics);

// Add compound indexes for efficient querying
SharesMetricsSchema.index(
  { source: 1, period: 1, timestamp: -1 },
  { name: 'source_period_timestamp_idx' },
);

SharesMetricsSchema.index(
  { timestamp: 1 },
  { name: 'timestamp_idx', expireAfterSeconds: 31536000 }, // 1 year TTL
);

SharesMetricsSchema.index(
  { source: 1, period: 1 },
  { name: 'source_period_idx' },
);

// Add indexes for shares analytics
SharesMetricsSchema.index(
  { 'ownership.totalShares': -1 },
  { name: 'total_shares_idx' },
);

SharesMetricsSchema.index(
  { 'valuation.marketCapitalization': -1 },
  { name: 'market_cap_idx' },
);

SharesMetricsSchema.index(
  { 'subscriptions.successRate': -1 },
  { name: 'subscription_success_rate_idx' },
);

SharesMetricsSchema.index(
  { 'transfers.successRate': -1 },
  { name: 'transfer_success_rate_idx' },
);

export type SharesMetricsModel = SharesMetrics & Document;
