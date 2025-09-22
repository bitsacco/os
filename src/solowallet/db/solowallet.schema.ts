import { Logger } from '@nestjs/common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  AbstractDocument,
  parseFmLightning,
  parseTransactionStatus,
  parseTransactionType,
  SolowalletTx,
  TransactionStatus,
  TransactionType,
  WalletType,
  LockPeriod,
} from '../../common';

@Schema({ versionKey: false })
export class SolowalletDocument extends AbstractDocument {
  @Prop({ type: String, required: true })
  userId: string;

  @Prop({ type: Number, required: true })
  amountMsats: number;

  @Prop({ type: Number, required: false })
  amountFiat?: number;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(TransactionType),
  })
  type: TransactionType;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(TransactionStatus),
  })
  status: TransactionStatus;

  @Prop({ type: String, required: true })
  lightning: string;

  @Prop({ type: String, required: true })
  paymentTracker?: string;

  @Prop({ type: String, required: true })
  reference: string;

  @Prop({ type: String, required: false })
  idempotencyKey?: string;

  @Prop({ type: Date, required: false })
  stateChangedAt?: Date;

  @Prop({ type: Date, required: false })
  timeoutAt?: Date;

  @Prop({ type: Number, required: false, default: 0 })
  retryCount?: number;

  @Prop({ type: Number, required: false, default: 3 })
  maxRetries?: number;

  // ========== NEW OPTIONAL FIELDS FOR WALLET VARIANTS ==========

  @Prop({
    type: String,
    enum: Object.values(WalletType),
    default: WalletType.STANDARD, // Default ensures backward compatibility
  })
  walletType?: WalletType;

  @Prop({ type: String })
  walletName?: string; // Custom wallet name

  // Target wallet fields
  @Prop({ type: Number })
  targetAmountMsats?: number; // Target amount in msats for savings goals

  @Prop({ type: Number })
  targetAmountFiat?: number; // Target amount in fiat for savings goals

  @Prop({ type: Date })
  targetDate?: Date; // Target date for savings goals

  @Prop({ type: Number })
  progressPercentage?: number; // Calculated progress (0-100)

  @Prop({ type: [Date] })
  milestoneReached?: Date[]; // Milestone achievement dates

  // Locked wallet fields
  @Prop({ type: String, enum: Object.values(LockPeriod) })
  lockPeriod?: LockPeriod; // Lock period configuration

  @Prop({ type: Date })
  lockEndDate?: Date; // When locked savings unlocks

  @Prop({ type: Boolean })
  autoRenew?: boolean; // Auto-renew locked savings

  @Prop({ type: Number })
  penaltyRate?: number; // Early withdrawal penalty percentage

  // Metadata
  @Prop({ type: [String] })
  tags?: string[]; // User-defined tags

  @Prop({ type: String })
  category?: string; // Transaction category

  @Prop({ type: String })
  notes?: string; // User notes

  // Wallet grouping
  @Prop({ type: String })
  walletId?: string; // Groups transactions for same wallet variant
}

export const SolowalletSchema =
  SchemaFactory.createForClass(SolowalletDocument);

// Ensure uniqueness only when paymentTracker is not null
SolowalletSchema.index({ paymentTracker: 1 }, { unique: true, sparse: true });

// Ensure uniqueness for idempotency keys per user and transaction type
SolowalletSchema.index(
  { userId: 1, type: 1, idempotencyKey: 1 },
  { unique: true, sparse: true },
);

// Add new indexes for wallet features (additive only)
SolowalletSchema.index({ userId: 1, walletType: 1 });
SolowalletSchema.index({ userId: 1, walletId: 1 });
SolowalletSchema.index({ walletId: 1, createdAt: -1 });

export function toSolowalletTx(
  doc: SolowalletDocument,
  logger: Logger,
): SolowalletTx {
  return {
    id: doc._id,
    userId: doc.userId,
    amountMsats: doc.amountMsats,
    amountFiat: doc.amountFiat,
    reference: doc.reference,
    status: parseTransactionStatus<TransactionStatus>(
      doc.status.toString(),
      TransactionStatus.UNRECOGNIZED,
      logger,
    ),
    type: parseTransactionType(doc.type.toString(), logger),
    lightning: parseFmLightning(doc.lightning, logger),
    createdAt: doc.createdAt.toDateString(),
    updatedAt: doc.updatedAt.toDateString(),
  };
}
