import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from './abstract.schema';

export enum ApiKeyScope {
  // User-related scopes
  UserRead = 'user:read',
  UserWrite = 'user:write',

  // Transaction-related scopes
  TransactionRead = 'transaction:read',
  TransactionWrite = 'transaction:write',

  // Financial scopes
  SharesRead = 'shares:read',
  SharesWrite = 'shares:write',
  SolowalletRead = 'solowallet:read',
  SolowalletWrite = 'solowallet:write',
  ChamaRead = 'chama:read',
  ChamaWrite = 'chama:write',

  // Admin scopes
  AdminAccess = 'admin:access',

  // Service-to-service scopes
  ServiceAuth = 'service:auth',
  ServiceSms = 'service:sms',
  ServiceNostr = 'service:nostr',
  ServiceShares = 'service:shares',
  ServiceSolowallet = 'service:solowallet',
  ServiceChama = 'service:chama',
  ServiceNotification = 'service:notification',
  ServiceSwap = 'service:swap',
}

@Schema()
export class ApiKeyDocument extends AbstractDocument {
  @Prop({ required: true, unique: true, index: true })
  keyHash: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ type: [String], default: [] })
  scopes: ApiKeyScope[];

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  revoked: boolean;

  @Prop({ type: Date, required: false })
  lastUsed?: Date;

  @Prop({ default: false })
  isPermanent: boolean;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKeyDocument);
