import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepository } from '../../database/abstract.repository';
import {
  PermissionAuditDocument,
  PermissionAction,
  AuditResource,
  AuditContext,
} from '../database/permission-audit-log.schema';

@Injectable()
export class PermissionAuditRepository extends AbstractRepository<PermissionAuditDocument> {
  protected readonly logger = new Logger(PermissionAuditRepository.name);

  constructor(
    @InjectModel(PermissionAuditDocument.name)
    permissionAuditModel: Model<PermissionAuditDocument>,
  ) {
    super(permissionAuditModel);
  }

  async log(params: {
    userId: string;
    permission: string;
    action: PermissionAction;
    result: boolean;
    resource?: AuditResource;
    reason?: string;
    context: AuditContext;
  }): Promise<void> {
    try {
      await this.create({
        timestamp: new Date(),
        userId: params.userId,
        permission: params.permission,
        action: params.action,
        result: params.result,
        resource: params.resource,
        reason: params.reason,
        context: params.context,
      } as any);
    } catch (error) {
      this.logger.error(`Error logging permission audit: ${error.message}`);
    }
  }

  async findByUser(
    userId: string,
    limit = 100,
  ): Promise<PermissionAuditDocument[]> {
    return this.find({ userId }, { timestamp: -1 }).then((docs) =>
      docs.slice(0, limit),
    );
  }

  async findByPermission(
    permission: string,
    limit = 100,
  ): Promise<PermissionAuditDocument[]> {
    return this.find({ permission }, { timestamp: -1 }).then((docs) =>
      docs.slice(0, limit),
    );
  }

  async findDeniedAccess(limit = 100): Promise<PermissionAuditDocument[]> {
    return this.find(
      { action: PermissionAction.DENIED, result: false },
      { timestamp: -1 },
    ).then((docs) => docs.slice(0, limit));
  }
}
