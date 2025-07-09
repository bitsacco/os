import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  AbstractDocument,
  SharesTx,
  SharesTxStatus,
  type SharesTxTransferMeta,
} from '@bitsacco/common';

@Schema({ versionKey: false })
export class SharesOfferDocument extends AbstractDocument {
  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: Number, required: true, default: 0 })
  subscribedQuantity: number;

  @Prop({ type: Date, required: true, default: Date.now })
  availableFrom: Date;

  @Prop({ type: Date, required: false })
  availableTo?: Date;
}

export const SharesOfferSchema =
  SchemaFactory.createForClass(SharesOfferDocument);

@Schema({ versionKey: false })
export class SharesDocument extends AbstractDocument {
  @Prop({ type: String, required: true })
  userId: string;

  @Prop({ type: String, required: true })
  offerId: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(SharesTxStatus),
  })
  status: SharesTxStatus;

  @Prop({
    type: Object,
    required: false,
  })
  transfer?: SharesTxTransferMeta;

  @Prop({ type: Number, required: true })
  quantity: number;
}

export const SharesSchema = SchemaFactory.createForClass(SharesDocument);

export function toSharesTx(doc: SharesDocument): SharesTx {
  let status: SharesTxStatus;

  if (doc.status === undefined || doc.status.toString() === '0') {
    status = SharesTxStatus.PROPOSED;
  } else if (doc.status.toString() === '1') {
    status = SharesTxStatus.PROCESSING;
  } else if (doc.status.toString() === '2') {
    status = SharesTxStatus.APPROVED;
  } else if (doc.status.toString() === '3') {
    status = SharesTxStatus.COMPLETE;
  } else if (doc.status.toString() === '4') {
    status = SharesTxStatus.FAILED;
  } else {
    status = SharesTxStatus.UNRECOGNIZED;
  }

  return {
    id: doc._id,
    userId: doc.userId,
    offerId: doc.offerId,
    quantity: doc.quantity,
    status,
    transfer: doc.transfer,
    createdAt: doc.createdAt.toDateString(),
    updatedAt: doc.updatedAt.toDateString(),
  };
}
