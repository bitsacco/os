import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  AbstractDocument,
  FmInvoice,
  SolowalletTx,
  TransactionStatus,
  TransactionType,
} from '@bitsacco/common';

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

  @Prop({ type: String, required: true, unique: true })
  paymentTracker?: string;

  @Prop({ type: String, required: true })
  reference: string;
}

export const SolowalletSchema =
  SchemaFactory.createForClass(SolowalletDocument);

// Ensure uniqueness only when paymentTracker is not null
SolowalletSchema.index({ paymentTracker: 1 }, { unique: true, sparse: true });

export function toSolowalletTx(doc: SolowalletDocument): SolowalletTx {
  let lightning: FmInvoice;
  try {
    lightning = JSON.parse(doc.lightning);
  } catch (error) {
    this.logger.warn('Error parsing lightning invoice', error);
    lightning = {
      invoice: '',
      operationId: '',
    };
  }

  let status = TransactionStatus.UNRECOGNIZED;
  try {
    status = Number(doc.status) as TransactionStatus;
  } catch (error) {
    this.logger.warn('Error parsing transaction status', error);
  }

  let type = TransactionType.UNRECOGNIZED;
  try {
    type = Number(doc.type) as TransactionType;
  } catch (error) {
    this.logger.warn('Error parsing transaction type', error);
  }

  return {
    status,
    type,
    lightning,
    id: doc._id,
    userId: doc.userId,
    amountMsats: doc.amountMsats,
    amountFiat: doc.amountFiat,
    reference: doc.reference,
    createdAt: doc.createdAt.toDateString(),
    updatedAt: doc.updatedAt.toDateString(),
  };
}
