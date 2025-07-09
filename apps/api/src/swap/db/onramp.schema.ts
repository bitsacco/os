import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '@bitsacco/common';
import { SwapTransactionState } from './types';

@Schema({ versionKey: false })
export class MpesaOnrampSwapDocument extends AbstractDocument {
  @Prop({
    type: String,
    enum: Object.values(SwapTransactionState),
    required: true,
  })
  state: SwapTransactionState;

  @Prop({ type: String, required: true })
  reference: string;

  @Prop({ type: String, required: true })
  lightning: string;

  @Prop({ type: String, required: false })
  collectionTracker?: string;

  @Prop({ type: String, required: true })
  rate: string;

  @Prop({ type: String, required: true })
  amountSats: string;

  @Prop({ type: Number, required: true })
  retryCount: number;
}

export const MpesaOnrampSwapSchema = SchemaFactory.createForClass(
  MpesaOnrampSwapDocument,
);

// Ensure uniqueness only when collectionTracker is not null
MpesaOnrampSwapSchema.index(
  { collectionTracker: 1 },
  { unique: true, sparse: true },
);
