import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from './abstract.schema';

@Schema({ versionKey: false, collection: 'tokens' })
export class TokenDocument extends AbstractDocument {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, unique: true })
  tokenId: string;

  @Prop({ required: true })
  expires: Date;

  @Prop({ default: false })
  revoked: boolean;
}

export const TokenSchema = SchemaFactory.createForClass(TokenDocument);
