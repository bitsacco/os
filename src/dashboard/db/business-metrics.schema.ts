import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  BaseMetrics,
  BaseMetricsDocument,
} from '../../common/database/metrics.schema';

/**
 * User engagement metrics sub-document
 */
@Schema({ _id: false })
export class UserEngagement {
  @Prop({ type: Number, default: 0 })
  dailyActiveUsers: number;

  @Prop({ type: Number, default: 0 })
  monthlyActiveUsers: number;

  @Prop({ type: Number, default: 0 })
  weeklyActiveUsers: number;

  @Prop({ type: Number, default: 0 })
  newUserRegistrations: number;

  @Prop({ type: Number, default: 0 })
  dau_mau_ratio: number;
}

/**
 * Session metrics sub-document
 */
@Schema({ _id: false })
export class SessionMetrics {
  @Prop({ type: Number, default: 0 })
  total: number;

  @Prop({ type: Number, default: 0 })
  averageDuration: number;

  @Prop({ type: Object, default: {} })
  byDevice: Record<string, number>;

  @Prop({ type: Object, default: {} })
  byVersion: Record<string, number>;

  @Prop({ type: Number, default: 0 })
  peakConcurrentUsers: number;
}

/**
 * Feature usage details sub-document
 */
@Schema({ _id: false })
export class FeatureUsageDetails {
  @Prop({ type: Number, default: 0 })
  usageCount: number;

  @Prop({ type: Number, default: 0 })
  successCount: number;

  @Prop({ type: Number, default: 0 })
  failureCount: number;

  @Prop({ type: Number, default: 0 })
  totalDuration: number;

  @Prop({ type: Number, default: 0 })
  averageDuration: number;
}

/**
 * User retention metrics sub-document
 */
@Schema({ _id: false })
export class RetentionMetrics {
  @Prop({ type: Number, default: 0 })
  day1: number;

  @Prop({ type: Number, default: 0 })
  day7: number;

  @Prop({ type: Number, default: 0 })
  day30: number;

  @Prop({ type: Number, default: 0 })
  day90: number;
}

/**
 * Business metrics document interface
 */
export interface BusinessMetricsDocument extends BaseMetricsDocument {
  userEngagement: UserEngagement;
  sessions: SessionMetrics;
  featureUsage: Record<string, FeatureUsageDetails>;
  retention: RetentionMetrics;
}

/**
 * Business metrics MongoDB schema
 */
@Schema({
  collection: 'business_metrics',
  timestamps: true,
})
export class BusinessMetrics
  extends BaseMetrics
  implements BusinessMetricsDocument
{
  @Prop({ type: UserEngagement, default: () => new UserEngagement() })
  userEngagement: UserEngagement;

  @Prop({ type: SessionMetrics, default: () => new SessionMetrics() })
  sessions: SessionMetrics;

  @Prop({ type: Object, default: {} })
  featureUsage: Record<string, FeatureUsageDetails>;

  @Prop({ type: RetentionMetrics, default: () => new RetentionMetrics() })
  retention: RetentionMetrics;
}

export const BusinessMetricsSchema =
  SchemaFactory.createForClass(BusinessMetrics);

// Add compound indexes for efficient querying
BusinessMetricsSchema.index(
  { source: 1, period: 1, timestamp: -1 },
  { name: 'source_period_timestamp_idx' },
);

BusinessMetricsSchema.index(
  { timestamp: 1 },
  { name: 'timestamp_idx', expireAfterSeconds: 31536000 }, // 1 year TTL for automatic cleanup
);

BusinessMetricsSchema.index(
  { source: 1, period: 1 },
  { name: 'source_period_idx' },
);

export type BusinessMetricsModel = BusinessMetrics & Document;
