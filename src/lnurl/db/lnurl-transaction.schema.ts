import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { AbstractDocument } from '../../common/database/abstract.schema';
import { Currency, TransactionStatus } from '../../common/types';
import { LnurlType, LnurlSubType } from '../../common/types/lnurl';
import type { LnurlData, LnurlLightning } from '../../common/types/lnurl';

@Schema({ collection: 'lnurl_transactions', versionKey: false })
export class LnurlTransaction extends AbstractDocument {
  @Prop({
    type: String,
    enum: Object.values(LnurlType).filter((v) => typeof v === 'string'),
    required: true,
    index: true,
  })
  type: LnurlType;

  @Prop({
    type: String,
    enum: Object.values(LnurlSubType).filter((v) => typeof v === 'string'),
    required: false,
    index: true,
  })
  subType?: LnurlSubType;

  @Prop({
    type: Number,
    enum: Object.values(TransactionStatus).filter((v) => typeof v === 'number'),
    required: true,
    index: true,
  })
  status: TransactionStatus;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  userId: string;

  @Prop({
    type: String,
    required: false,
    index: true,
  })
  chamaId?: string;

  @Prop({
    type: Number,
    required: true,
  })
  amountMsats: number;

  @Prop({
    type: Number,
    required: true,
  })
  amountFiat: number;

  @Prop({
    type: Number,
    enum: Object.values(Currency).filter((v) => typeof v === 'number'),
    required: true,
  })
  currency: Currency;

  @Prop({
    type: Object,
    required: true,
  })
  lnurlData: LnurlData;

  @Prop({
    type: Object,
    required: false,
  })
  lightning?: LnurlLightning;

  @Prop({
    type: String,
    required: true,
  })
  reference: string;

  @Prop({
    type: Date,
    required: false,
  })
  completedAt?: Date;

  @Prop({
    type: String,
    required: false,
  })
  failureReason?: string;

  @Prop({
    type: Boolean,
    required: false,
    default: false,
  })
  refunded?: boolean;

  @Prop({ type: Map, of: String })
  metadata?: Map<string, any>;
}

export const LnurlTransactionSchema =
  SchemaFactory.createForClass(LnurlTransaction);

// Indexes for performance
LnurlTransactionSchema.index({ userId: 1, createdAt: -1 });
LnurlTransactionSchema.index({ chamaId: 1, createdAt: -1 });
LnurlTransactionSchema.index({ type: 1, status: 1 });
LnurlTransactionSchema.index({ 'lnurlData.withdraw.k1': 1 });
LnurlTransactionSchema.index({ 'lnurlData.lightningAddress.addressId': 1 });
LnurlTransactionSchema.index({ 'lightning.operationId': 1 });

export type LnurlTransactionDocument = LnurlTransaction & Document;
