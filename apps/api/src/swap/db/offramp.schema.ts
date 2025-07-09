import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '@bitsacco/common';
import { SwapTransactionState } from './types';

@Schema({ versionKey: false })
export class MpesaOfframpSwapDocument extends AbstractDocument {
  @Prop({
    type: String,
    enum: Object.values(SwapTransactionState),
    required: true,
  })
  state: string;

  @Prop({ type: String, required: true })
  reference: string;

  @Prop({ type: String, required: true })
  lightning: string;

  @Prop({ type: String, required: true })
  phone: string;

  @Prop({ type: String, required: false })
  paymentTracker?: string;

  @Prop({ type: String, required: true })
  rate: string;

  @Prop({ type: String, required: true })
  amountSats: string;

  @Prop({ type: Number, required: true })
  retryCount: number;
}

export const MpesaOfframpSwapSchema = SchemaFactory.createForClass(
  MpesaOfframpSwapDocument,
);

// Ensure uniqueness only when paymentTracker is not null
MpesaOfframpSwapSchema.index(
  { paymentTracker: 1 },
  { unique: true, sparse: true },
);
