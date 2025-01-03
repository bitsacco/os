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

export function toSharesTx(share: SharesDocument): SharesTx {
  let status: SharesTxStatus;

  if (share.status === undefined || share.status.toString() === '0') {
    status = SharesTxStatus.PROPOSED;
  } else if (share.status.toString() === '1') {
    status = SharesTxStatus.PROCESSING;
  } else if (share.status.toString() === '2') {
    status = SharesTxStatus.APPROVED;
  } else if (share.status.toString() === '3') {
    status = SharesTxStatus.COMPLETE;
  } else if (share.status.toString() === '4') {
    status = SharesTxStatus.FAILED;
  } else {
    status = SharesTxStatus.UNRECOGNIZED;
  }

  return {
    id: share._id,
    userId: share.userId,
    offerId: share.offerId,
    quantity: share.quantity,
    status,
    transfer: share.transfer,
    createdAt: share.createdAt.toDateString(),
    updatedAt: share.updatedAt.toDateString(),
  };
}
