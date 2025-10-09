import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '../../database/abstract.schema';

export enum PermissionCategory {
  User = 'user',
  Chama = 'chama',
  Wallet = 'wallet',
  Transaction = 'transaction',
  Personal = 'personal',
  Shares = 'shares',
  Notification = 'notification',
  Admin = 'admin',
}

export interface PermissionMetadata {
  createdAt: Date;
  updatedAt: Date;
  isDeprecated: boolean;
  supersededBy?: string;
}

@Schema({ versionKey: false, collection: 'permissions' })
export class PermissionDocument extends AbstractDocument {
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  permission: string;

  @Prop({
    type: String,
    required: true,
  })
  description: string;

  @Prop({
    type: String,
    enum: Object.values(PermissionCategory),
    required: true,
    index: true,
  })
  category: PermissionCategory;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  requiresContext: boolean;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  isConditional: boolean;

  @Prop({
    type: Object,
    required: true,
    default: () => ({
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeprecated: false,
    }),
  })
  metadata: PermissionMetadata;
}

export const PermissionSchema =
  SchemaFactory.createForClass(PermissionDocument);

PermissionSchema.index({ permission: 1 }, { unique: true });
PermissionSchema.index({ category: 1 });
