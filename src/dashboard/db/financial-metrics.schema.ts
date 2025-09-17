import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  BaseMetrics,
  BaseMetricsDocument,
} from '../../common/database/metrics.schema';

/**
 * Transaction volume sub-document
 */
@Schema({ _id: false })
export class TransactionVolume {
  @Prop({ type: Number, default: 0 })
  total: number;

  @Prop({ type: Number, default: 0 })
  today: number;

  @Prop({ type: Number, default: 0 })
  thisWeek: number;

  @Prop({ type: Number, default: 0 })
  thisMonth: number;

  @Prop({ type: Object, default: {} })
  byCurrency: Record<string, number>;

  @Prop({ type: Object, default: {} })
  byOperation: Record<string, number>;
}

/**
 * Transaction counts sub-document
 */
@Schema({ _id: false })
export class TransactionCounts {
  @Prop({ type: Number, default: 0 })
  total: number;

  @Prop({ type: Number, default: 0 })
  successful: number;

  @Prop({ type: Number, default: 0 })
  failed: number;

  @Prop({ type: Number, default: 0 })
  pending: number;

  @Prop({ type: Number, default: 0 })
  averagePerDay: number;
}

/**
 * Transaction performance sub-document
 */
@Schema({ _id: false })
export class TransactionPerformance {
  @Prop({ type: Number, default: 0 })
  averageDuration: number;

  @Prop({ type: Number, default: 0 })
  successRate: number;

  @Prop({ type: Object, default: {} })
  errorsByType: Record<string, number>;
}

/**
 * Complete transaction metrics sub-document
 */
@Schema({ _id: false })
export class TransactionMetrics {
  @Prop({ type: TransactionVolume, default: () => new TransactionVolume() })
  volume: TransactionVolume;

  @Prop({ type: TransactionCounts, default: () => new TransactionCounts() })
  counts: TransactionCounts;

  @Prop({
    type: TransactionPerformance,
    default: () => new TransactionPerformance(),
  })
  performance: TransactionPerformance;
}

/**
 * Swap metrics sub-document
 */
@Schema({ _id: false })
export class SwapMetrics {
  @Prop({ type: Number, default: 0 })
  count: number;

  @Prop({ type: Number, default: 0 })
  successful: number;

  @Prop({ type: Number, default: 0 })
  failed: number;

  @Prop({ type: Number, default: 0 })
  successRate: number;

  @Prop({ type: Number, default: 0 })
  totalKes: number;

  @Prop({ type: Number, default: 0 })
  totalSats: number;

  @Prop({ type: Object, default: {} })
  byPaymentMethod: Record<string, number>;

  @Prop({ type: Number, default: 0 })
  averageDuration: number;
}

/**
 * FX rate data sub-document
 */
@Schema({ _id: false })
export class FxRateData {
  @Prop({ type: Number, default: 0 })
  latestBuyRate: number;

  @Prop({ type: Number, default: 0 })
  latestSellRate: number;

  @Prop({ type: Number, default: 0 })
  spread: number;

  @Prop({ type: Number, default: 0 })
  volatility: number;

  @Prop({ type: Date })
  lastUpdated: Date;
}

/**
 * Volume data sub-document
 */
@Schema({ _id: false })
export class VolumeData {
  @Prop({ type: Number, default: 0 })
  totalVolume: number;

  @Prop({ type: Number, default: 0 })
  onrampVolume: number;

  @Prop({ type: Number, default: 0 })
  offrampVolume: number;

  @Prop({ type: Number, default: 0 })
  averageTransactionSize: number;
}

/**
 * Chama financial data sub-document
 */
@Schema({ _id: false })
export class ChamaFinancialData {
  @Prop({ type: Number, default: 0 })
  totalContributions: number;

  @Prop({ type: Number, default: 0 })
  totalWithdrawals: number;

  @Prop({ type: Number, default: 0 })
  activeContributors: number;

  @Prop({ type: Number, default: 0 })
  averageContribution: number;

  @Prop({ type: Number, default: 0 })
  totalBalance: number;
}

/**
 * Shares financial data sub-document
 */
@Schema({ _id: false })
export class SharesFinancialData {
  @Prop({ type: Number, default: 0 })
  totalShareValue: number;

  @Prop({ type: Number, default: 0 })
  totalSubscriptions: number;

  @Prop({ type: Number, default: 0 })
  totalTransfers: number;

  @Prop({ type: Number, default: 0 })
  averageSharePrice: number;

  @Prop({ type: Number, default: 0 })
  marketCapitalization: number;
}

/**
 * Complete swaps metrics sub-document
 */
@Schema({ _id: false })
export class SwapsMetrics {
  @Prop({ type: SwapMetrics, default: () => new SwapMetrics() })
  onramp: SwapMetrics;

  @Prop({ type: SwapMetrics, default: () => new SwapMetrics() })
  offramp: SwapMetrics;

  @Prop({ type: FxRateData, default: () => new FxRateData() })
  fxRates: FxRateData;

  @Prop({ type: VolumeData, default: () => new VolumeData() })
  volume: VolumeData;
}

/**
 * Financial metrics document interface
 */
export interface FinancialMetricsDocument extends BaseMetricsDocument {
  transactions: TransactionMetrics;
  swaps: SwapsMetrics;
  chamas: ChamaFinancialData;
  shares: SharesFinancialData;
}

/**
 * Financial metrics MongoDB schema
 */
@Schema({
  collection: 'financial_metrics',
  timestamps: true,
})
export class FinancialMetrics
  extends BaseMetrics
  implements FinancialMetricsDocument
{
  @Prop({ type: TransactionMetrics, default: () => new TransactionMetrics() })
  transactions: TransactionMetrics;

  @Prop({ type: SwapsMetrics, default: () => new SwapsMetrics() })
  swaps: SwapsMetrics;

  @Prop({ type: ChamaFinancialData, default: () => new ChamaFinancialData() })
  chamas: ChamaFinancialData;

  @Prop({ type: SharesFinancialData, default: () => new SharesFinancialData() })
  shares: SharesFinancialData;
}

export const FinancialMetricsSchema =
  SchemaFactory.createForClass(FinancialMetrics);

// Add compound indexes for efficient querying
FinancialMetricsSchema.index(
  { source: 1, period: 1, timestamp: -1 },
  { name: 'source_period_timestamp_idx' },
);

FinancialMetricsSchema.index(
  { timestamp: 1 },
  { name: 'timestamp_idx', expireAfterSeconds: 31536000 }, // 1 year TTL
);

FinancialMetricsSchema.index(
  { source: 1, period: 1 },
  { name: 'source_period_idx' },
);

// Add indexes for financial analytics
FinancialMetricsSchema.index(
  { 'transactions.volume.total': -1 },
  { name: 'transaction_volume_idx' },
);

FinancialMetricsSchema.index(
  { 'swaps.volume.totalVolume': -1 },
  { name: 'swap_volume_idx' },
);

export type FinancialMetricsModel = FinancialMetrics & Document;
