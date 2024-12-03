import { AbstractDocument } from '@bitsacco/common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ versionKey: false })
export class UserDocument extends AbstractDocument {
  @Prop({ type: String, required: true })
  pin: string;

  @Prop({ type: String, required: false, unique: true })
  phone?: string;

  @Prop({ type: Boolean, required: true })
  phoneVerified: boolean;

  @Prop({ type: String, required: false, unique: true })
  npub?: string;

  @Prop({ type: String, required: false })
  name?: string;

  @Prop({ type: String, required: false })
  avatarUrl?: string;

  @Prop()
  roles?: string[];
}

export const UserSchema = SchemaFactory.createForClass(UserDocument);

// Ensure uniqueness only when phone is not null
UserSchema.index(
  {
    phone: 1,
    npub: 1,
  },
  { unique: true, sparse: true },
);
