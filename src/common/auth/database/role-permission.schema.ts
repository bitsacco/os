import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '../../database/abstract.schema';
import { Role } from '../../types';

export interface RolePermissionMetadata {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ versionKey: false, collection: 'role_permissions' })
export class RolePermissionDocument extends AbstractDocument {
  @Prop({
    type: Number,
    enum: Object.values(Role).filter((v) => typeof v === 'number'),
    required: true,
    unique: true,
    index: true,
  })
  role: Role;

  @Prop({
    type: [String],
    required: true,
    default: [],
  })
  permissions: string[];

  @Prop({
    type: String,
    required: true,
  })
  description: string;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  isSystem: boolean;

  @Prop({
    type: Object,
    required: true,
    default: () => ({
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  })
  metadata: RolePermissionMetadata;
}

export const RolePermissionSchema = SchemaFactory.createForClass(
  RolePermissionDocument,
);

RolePermissionSchema.index({ role: 1 }, { unique: true });
