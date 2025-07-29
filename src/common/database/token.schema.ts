import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from './abstract.schema';

@Schema({ versionKey: false, collection: 'tokens' })
export class TokenDocument extends AbstractDocument {
  @Prop({ type: String, required: true })
  userId: string;

  @Prop({ type: String, required: true, unique: true })
  tokenId: string;

  @Prop({ type: String, required: true })
  tokenFamily: string;

  @Prop({ type: String })
  previousTokenId: string;

  @Prop({ type: Date, required: true })
  expires: Date;

  @Prop({ type: Boolean, default: false })
  revoked: boolean;
}

export const TokenSchema = SchemaFactory.createForClass(TokenDocument);
