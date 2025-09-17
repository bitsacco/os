import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  AbstractDocument,
  ChamaTxStatus,
  parseFmLightning,
  parseTransactionStatus,
  parseTransactionType,
  TransactionType,
  type ChamaTxReview,
  type ChamaWalletTx,
} from '../../common';
import { Logger } from '@nestjs/common';

@Schema({ versionKey: false })
export class ChamaWalletDocument extends AbstractDocument {
  @Prop({ type: String, required: true })
  memberId: string;

  @Prop({ type: String, required: true })
  chamaId: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(ChamaTxStatus),
  })
  status: ChamaTxStatus;

  @Prop({ type: Number, required: true })
  amountMsats: number;

  @Prop({ type: Number, required: false })
  amountFiat?: number;

  @Prop({ type: String, required: true })
  lightning: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(TransactionType),
  })
  type: TransactionType;

  @Prop({ type: [{ type: Array, required: true }] })
  reviews: ChamaTxReview[];

  @Prop({ type: String, required: true })
  reference: string;

  @Prop({ type: String, required: true })
  paymentTracker?: string;

  @Prop({ type: String, required: false })
  context?: string;

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
}

export const ChamaWalletSchema =
  SchemaFactory.createForClass(ChamaWalletDocument);

// Ensure uniqueness for idempotency keys per member, chama and transaction type
ChamaWalletSchema.index(
  { memberId: 1, chamaId: 1, type: 1, idempotencyKey: 1 },
  { unique: true, sparse: true },
);

// Ensure uniqueness only when paymentTracker is not null
ChamaWalletSchema.index({ paymentTracker: 1 }, { unique: true, sparse: true });

export function toChamaWalletTx(
  doc: ChamaWalletDocument,
  logger: Logger,
): ChamaWalletTx {
  let createdAt: string;
  try {
    createdAt = doc.createdAt.toDateString();
  } catch (error) {
    logger.warn(`Error parsing transaction createdAt ${error}`);
    createdAt = doc.createdAt.toString();
  }

  let updatedAt: string;
  try {
    updatedAt = doc.updatedAt.toDateString();
  } catch (error) {
    logger.warn(`Error parsing transaction updatedAt ${error}`);
    updatedAt = doc.updatedAt.toString();
  }

  return {
    id: doc._id,
    memberId: doc.memberId,
    chamaId: doc.chamaId,
    amountMsats: doc.amountMsats,
    amountFiat: doc.amountFiat,
    reviews: doc.reviews,
    reference: doc.reference,
    status: parseTransactionStatus<ChamaTxStatus>(
      doc.status.toString(),
      ChamaTxStatus.UNRECOGNIZED,
      logger,
    ),
    type: parseTransactionType(doc.type.toString(), logger),
    lightning: parseFmLightning(doc.lightning, logger),
    createdAt,
    updatedAt,
  };
}
