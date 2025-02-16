import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  AbstractDocument,
  ChamaTxStatus,
  TransactionType,
  type ChamaTxReview,
  type ChamaWalletTx,
  type FmInvoice,
} from '@bitsacco/common';

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

  @Prop({ type: String, required: true, unique: true })
  paymentTracker?: string;
}

export const ChamaWalletSchema =
  SchemaFactory.createForClass(ChamaWalletDocument);

// Ensure uniqueness only when paymentTracker is not null
ChamaWalletSchema.index({ paymentTracker: 1 }, { unique: true, sparse: true });

export function toChamaWalletTx(doc: ChamaWalletDocument): ChamaWalletTx {
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

  let status = ChamaTxStatus.UNRECOGNIZED;
  try {
    status = Number(doc.status) as ChamaTxStatus;
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
    memberId: doc.memberId,
    chamaId: doc.chamaId,
    amountMsats: doc.amountMsats,
    amountFiat: doc.amountFiat,
    reviews: doc.reviews,
    reference: doc.reference,
    createdAt: doc.createdAt.toDateString(),
    updatedAt: doc.updatedAt.toDateString(),
  };
}
