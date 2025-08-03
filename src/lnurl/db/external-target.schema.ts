import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '../../common';
import type {
  ExternalTargetInfo,
  ExternalTargetStats,
  ExternalTargetPreferences,
  ExternalTargetMetadata,
  ExternalLnurlTargetDocument as IExternalLnurlTargetDocument,
} from '../../common';

@Schema()
class TargetMetadata implements ExternalTargetMetadata {
  @Prop({ type: String, required: true })
  callback: string;

  @Prop({ type: Number, required: true })
  minSendable: number;

  @Prop({ type: Number, required: true })
  maxSendable: number;

  @Prop({ type: Number, required: false })
  commentAllowed?: number;

  @Prop({ type: String, required: true })
  tag: string;

  @Prop({ type: String, required: true })
  metadata: string;

  @Prop({ type: Date, required: true })
  cachedAt: Date;

  @Prop({ type: Number, required: true, default: 3600 }) // 1 hour default
  ttl: number;
}

@Schema()
class TargetInfo implements ExternalTargetInfo {
  @Prop({ type: String, required: false, index: true })
  address?: string;

  @Prop({ type: String, required: false })
  lnurl?: string;

  @Prop({ type: String, required: true, index: true })
  domain: string;

  @Prop({ type: TargetMetadata, required: false })
  metadata?: ExternalTargetMetadata;
}

@Schema()
class TargetStats implements ExternalTargetStats {
  @Prop({ type: Date, required: false })
  lastUsedAt?: Date;

  @Prop({ type: Number, required: true, default: 0 })
  totalSent: number;

  @Prop({ type: Number, required: true, default: 0 })
  paymentCount: number;
}

@Schema()
class TargetPreferences implements ExternalTargetPreferences {
  @Prop({ type: String, required: false })
  nickname?: string;

  @Prop({ type: Boolean, required: true, default: false })
  isFavorite: boolean;

  @Prop({ type: String, required: false })
  defaultComment?: string;
}

@Schema({ collection: 'external_lnurl_targets', versionKey: false })
export class ExternalLnurlTarget
  extends AbstractDocument
  implements Omit<IExternalLnurlTargetDocument, '_id'>
{
  @Prop({
    type: String,
    required: true,
    index: true,
  })
  userId: string;

  @Prop({
    type: String,
    enum: ['LNURL_PAY', 'LIGHTNING_ADDRESS'],
    required: true,
  })
  type: 'LNURL_PAY' | 'LIGHTNING_ADDRESS';

  @Prop({
    type: TargetInfo,
    required: true,
  })
  target: ExternalTargetInfo;

  @Prop({
    type: TargetStats,
    required: true,
  })
  stats: ExternalTargetStats;

  @Prop({
    type: TargetPreferences,
    required: true,
  })
  preferences: ExternalTargetPreferences;
}

export const ExternalLnurlTargetSchema =
  SchemaFactory.createForClass(ExternalLnurlTarget);

// Indexes
ExternalLnurlTargetSchema.index({ userId: 1, 'target.address': 1 });
ExternalLnurlTargetSchema.index({ userId: 1, 'preferences.isFavorite': -1 });
ExternalLnurlTargetSchema.index({ userId: 1, 'stats.lastUsedAt': -1 });

// TTL index for metadata cache
ExternalLnurlTargetSchema.index(
  { 'target.metadata.cachedAt': 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { 'target.metadata': { $exists: true } },
  },
);

export type ExternalLnurlTargetDocument = ExternalLnurlTarget & Document;
