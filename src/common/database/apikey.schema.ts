import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from './abstract.schema';

export enum ApiKeyScope {
  // Read operations
  Read = 'read',

  // Write operations
  Write = 'write',

  // Resource-specific scopes
  UsersRead = 'users:read',
  UsersWrite = 'users:write',
  TransactionsRead = 'transactions:read',
  TransactionsWrite = 'transactions:write',
  SharesRead = 'shares:read',
  SharesWrite = 'shares:write',
  SolowalletRead = 'solowallet:read',
  SolowalletWrite = 'solowallet:write',
  ChamaRead = 'chama:read',
  ChamaWrite = 'chama:write',

  // Admin operations
  AdminAccess = 'admin:access',
}

@Schema()
export class ApiKeyDocument extends AbstractDocument {
  @Prop({ type: String, required: true, unique: true, index: true })
  keyHash: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true, index: true })
  userId: string;

  @Prop({ type: [String], default: [] })
  scopes: ApiKeyScope[];

  @Prop({ type: Date, required: true, index: true })
  expiresAt: Date;

  @Prop({ type: Boolean, default: false })
  revoked: boolean;

  @Prop({ type: Date, required: false })
  lastUsed?: Date;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKeyDocument);
