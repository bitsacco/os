import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '@bitsacco/common';

@Schema({ versionKey: false })
export class SharesDocument extends AbstractDocument {
  @Prop({ type: String, required: true })
  userId: string;

  @Prop({ type: Number, required: true })
  quantity: number;
}

export const SharesSchema = SchemaFactory.createForClass(SharesDocument);
