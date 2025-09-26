import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';

export type WithdrawalRateLimitDocument = HydratedDocument<WithdrawalRateLimit>;

/**
 * Schema for storing user withdrawal rate limits in MongoDB.
 * This provides persistence for rate limiting data across service restarts.
 */
@Schema({
  collection: 'withdrawal_rate_limits',
  timestamps: true,
})
export class WithdrawalRateLimit extends Document {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({
    type: {
      count: { type: Number, default: 0 },
      totalSats: { type: Number, default: 0 },
      resetAt: { type: Date, required: true },
    },
    required: true,
  })
  daily: {
    count: number;
    totalSats: number;
    resetAt: Date;
  };

  @Prop({
    type: {
      count: { type: Number, default: 0 },
      totalSats: { type: Number, default: 0 },
      resetAt: { type: Date, required: true },
    },
    required: true,
  })
  hourly: {
    count: number;
    totalSats: number;
    resetAt: Date;
  };

  @Prop({
    type: {
      count: { type: Number, default: 0 },
      resetAt: { type: Date, required: true },
    },
    required: true,
  })
  burst: {
    count: number;
    resetAt: Date;
  };

  @Prop({ type: Date })
  blockedUntil?: Date;

  @Prop({ type: Number, default: 0 })
  suspiciousActivity: number;

  @Prop({ type: Date })
  lastWithdrawalAt?: Date;

  @Prop({
    type: [
      {
        timestamp: Date,
        amountSats: Number,
        type: String,
        blocked: Boolean,
        reason: String,
      },
    ],
    default: [],
  })
  recentAttempts: Array<{
    timestamp: Date;
    amountSats: number;
    type: string;
    blocked: boolean;
    reason?: string;
  }>;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const WithdrawalRateLimitSchema =
  SchemaFactory.createForClass(WithdrawalRateLimit);

// Indexes for efficient queries (userId already indexed via unique: true)
WithdrawalRateLimitSchema.index({ 'daily.resetAt': 1 });
WithdrawalRateLimitSchema.index({ 'hourly.resetAt': 1 });
WithdrawalRateLimitSchema.index({ blockedUntil: 1 });
WithdrawalRateLimitSchema.index({ updatedAt: -1 });

// TTL index to auto-delete old documents after 30 days of inactivity
WithdrawalRateLimitSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }, // 30 days
);
