import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '../../database/abstract.schema';

export enum PermissionAction {
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
  CHECKED = 'CHECKED',
  REVOKED = 'REVOKED',
}

export interface AuditResource {
  type: string;
  id: string;
}

export interface AuditContext {
  endpoint: string;
  method: string;
  ip?: string;
  userAgent?: string;
  grantedBy?: string;
  revokedBy?: string;
  resourceId?: string;
}

@Schema({ versionKey: false, collection: 'permission_audit_log' })
export class PermissionAuditDocument extends AbstractDocument {
  @Prop({
    type: Date,
    required: true,
    default: () => new Date(),
    index: true,
  })
  timestamp: Date;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  userId: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  permission: string;

  @Prop({
    type: Object,
    required: false,
  })
  resource?: AuditResource;

  @Prop({
    type: String,
    enum: Object.values(PermissionAction),
    required: true,
  })
  action: PermissionAction;

  @Prop({
    type: Boolean,
    required: true,
  })
  result: boolean;

  @Prop({
    type: String,
    required: false,
  })
  reason?: string;

  @Prop({
    type: Object,
    required: true,
  })
  context: AuditContext;
}

export const PermissionAuditSchema = SchemaFactory.createForClass(
  PermissionAuditDocument,
);

PermissionAuditSchema.index({ userId: 1, timestamp: -1 });
PermissionAuditSchema.index({ permission: 1, timestamp: -1 });
PermissionAuditSchema.index({ timestamp: -1 });
PermissionAuditSchema.index({ 'resource.type': 1, 'resource.id': 1 });

// TTL index for automatic cleanup after 90 days
PermissionAuditSchema.index(
  { timestamp: 1 },
  {
    expireAfterSeconds: 7776000, // 90 days
  },
);
