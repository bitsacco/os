import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { AbstractDocument } from '../../common/database/abstract.schema';
import {
  AddressType,
  LightningAddressMetadata,
  LightningAddressSettings,
  LightningAddressStats,
  LightningAddressDocument as ILightningAddressDocument,
} from '../types';

@Schema()
class Metadata implements LightningAddressMetadata {
  @Prop({ type: String, required: false })
  description?: string;

  @Prop({ type: String, required: false })
  imageUrl?: string;

  @Prop({ type: String, required: false })
  identifier?: string;

  @Prop({ type: String, required: false })
  email?: string;

  @Prop({ type: Number, required: true })
  minSendable: number;

  @Prop({ type: Number, required: true })
  maxSendable: number;

  @Prop({ type: Number, required: false })
  commentAllowed?: number;
}

@Schema()
class Settings implements LightningAddressSettings {
  @Prop({ type: Boolean, required: true, default: true })
  enabled: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  allowComments: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  notifyOnPayment: boolean;

  @Prop({ type: String, required: false })
  customSuccessMessage?: string;
}

@Schema()
class Stats implements LightningAddressStats {
  @Prop({ type: Number, required: true, default: 0 })
  totalReceived: number;

  @Prop({ type: Number, required: true, default: 0 })
  paymentCount: number;

  @Prop({ type: Date, required: false })
  lastPaymentAt?: Date;
}

@Schema({ collection: 'lightning_addresses', versionKey: false })
export class LightningAddress
  extends AbstractDocument
  implements Omit<ILightningAddressDocument, '_id'>
{
  @Prop({
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  address: string;

  @Prop({
    type: String,
    required: true,
    default: 'bitsacco.com',
  })
  domain: string;

  @Prop({
    type: String,
    enum: Object.values(AddressType),
    required: true,
    index: true,
  })
  type: AddressType;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  ownerId: string;

  @Prop({
    type: String,
    required: false,
    index: true,
  })
  memberId?: string;

  @Prop({
    type: Metadata,
    required: true,
  })
  metadata: LightningAddressMetadata;

  @Prop({
    type: Settings,
    required: true,
  })
  settings: LightningAddressSettings;

  @Prop({
    type: Stats,
    required: true,
  })
  stats: LightningAddressStats;
}

export const LightningAddressSchema =
  SchemaFactory.createForClass(LightningAddress);

// Indexes
LightningAddressSchema.index({ address: 1, domain: 1 }, { unique: true });
LightningAddressSchema.index({ ownerId: 1 });
LightningAddressSchema.index({ type: 1 });
LightningAddressSchema.index({ 'settings.enabled': 1 });

// Validation
LightningAddressSchema.pre('save', function (next) {
  // Validate address format
  const addressPattern = /^[a-zA-Z0-9._-]+$/;
  if (!addressPattern.test(this.address)) {
    next(new Error('Invalid address format'));
    return;
  }

  // Minimum length
  if (this.address.length < 3) {
    next(new Error('Address must be at least 3 characters long'));
    return;
  }

  // Reserved addresses
  const reserved = ['admin', 'support', 'api', 'www', 'mail', 'ftp'];
  if (reserved.includes(this.address.toLowerCase())) {
    next(new Error('This address is reserved'));
    return;
  }

  next();
});

export type LightningAddressDocument = LightningAddress & Document;
