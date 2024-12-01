import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument, TransactionStatus } from '@bitsacco/common';

@Schema({ versionKey: false })
export class SolowalletDocument extends AbstractDocument {
  @Prop({ type: String, required: true })
  userId: string;

  @Prop({ type: Number, required: true })
  amountMsats: number;

  @Prop({ type: Number, required: true })
  amountFiat: number;

  @Prop({
    type: String,
    enum: Object.values(TransactionStatus),
    required: true,
  })
  status: TransactionStatus;

  @Prop({ type: String, required: true })
  lightning: string;

  @Prop({ type: String, required: true })
  reference: string;
}

export const SolowalletSchema =
  SchemaFactory.createForClass(SolowalletDocument);
