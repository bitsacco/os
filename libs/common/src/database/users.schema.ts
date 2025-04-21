import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from './abstract.schema';
import {
  type Nostr,
  type Phone,
  type Profile,
  type User,
  Role,
} from '../types';

@Schema({ versionKey: false })
export class UsersDocument extends AbstractDocument {
  @Prop({
    type: String,
    required: true,
  })
  pinHash: string;

  @Prop({
    type: String,
    required: true,
  })
  otpHash: string;
  
  @Prop({
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minute expiry
  })
  otpExpiry: Date;

  @Prop({
    type: Object,
    required: false,
  })
  phone?: Phone;

  @Prop({
    type: Object,
    required: false,
  })
  nostr?: Nostr;

  @Prop({
    type: Object,
    required: false,
  })
  profile?: Profile;

  @Prop({
    type: [{ type: String, enum: Object.values(Role) }],
    required: true,
    validate: {
      validator: (roles: Role[]) => roles.length > 0,
      message: 'User must have at least one role',
    },
  })
  roles: Role[];
}

export const UsersSchema = SchemaFactory.createForClass(UsersDocument);

UsersSchema.index({ 'phone.number': 1 }, { unique: true, sparse: true });
UsersSchema.index({ 'nostr.npub': 1 }, { unique: true, sparse: true });

export function toUser(doc: UsersDocument): User {
  return {
    id: doc._id,
    phone: doc.phone,
    nostr: doc.nostr,
    profile: doc.profile,
    roles: doc.roles,
  };
}
