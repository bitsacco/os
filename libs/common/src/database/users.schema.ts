import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Role,
  type Nostr,
  type Phone,
  type Profile,
  type User,
} from '@bitsacco/common';
import { AbstractDocument } from './abstract.schema';

@Schema({ versionKey: false })
export class UsersDocument extends AbstractDocument {
  @Prop({
    type: String,
    required: true,
  })
  pinHash: string;

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

  @Prop({ type: [{ type: String, enum: Object.values(Role) }], required: true })
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
