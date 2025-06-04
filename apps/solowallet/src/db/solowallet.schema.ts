import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  AbstractDocument,
  parseFmLightning,
  parseTransactionStatus,
  parseTransactionType,
  SolowalletTx,
  TransactionStatus,
  TransactionType,
} from '@bitsacco/common';
import { Logger } from '@nestjs/common';

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
}

export const SolowalletSchema =
  SchemaFactory.createForClass(SolowalletDocument);

// Ensure uniqueness only when paymentTracker is not null
SolowalletSchema.index({ paymentTracker: 1 }, { unique: true, sparse: true });

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
