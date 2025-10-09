import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '../../database/abstract.schema';
import { Role } from '../../types';

export interface ChamaPermission {
  chamaId: string;
  permissions: string[];
}

export interface TemporaryPermission {
  permission: string;
  expiresAt: Date;
  grantedBy: string;
  reason?: string;
}

export interface PermissionMetadata {
  lastUpdated: Date;
  updatedBy: string;
}

@Schema({ versionKey: false, collection: 'user_permissions' })
export class UserPermissionDocument extends AbstractDocument {
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  userId: string;

  @Prop({
    type: [String],
    required: true,
    default: [],
  })
  permissions: string[];

  @Prop({
    type: [
      {
        chamaId: { type: String, required: true },
        permissions: { type: [String], required: true, default: [] },
      },
    ],
    required: true,
    default: [],
  })
  chamaPermissions: ChamaPermission[];

  @Prop({
    type: [
      {
        permission: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        grantedBy: { type: String, required: true },
        reason: { type: String, required: false },
      },
    ],
    required: true,
    default: [],
  })
  temporaryPermissions: TemporaryPermission[];

  @Prop({
    type: [{ type: Number, enum: Object.values(Role) }],
    required: true,
    default: [],
  })
  inheritedFromRoles: Role[];

  @Prop({
    type: [String],
    required: true,
    default: [],
  })
  deniedPermissions: string[];

  @Prop({
    type: Object,
    required: true,
    default: () => ({
      lastUpdated: new Date(),
      updatedBy: 'SYSTEM',
    }),
  })
  metadata: PermissionMetadata;
}

export const UserPermissionSchema = SchemaFactory.createForClass(
  UserPermissionDocument,
);

UserPermissionSchema.index({ userId: 1 }, { unique: true });
UserPermissionSchema.index({ 'chamaPermissions.chamaId': 1 });
UserPermissionSchema.index({ 'temporaryPermissions.expiresAt': 1 });
