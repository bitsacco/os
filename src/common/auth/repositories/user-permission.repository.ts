import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepository } from '../../database/abstract.repository';
import {
  UserPermissionDocument,
  TemporaryPermission,
} from '../database/user-permission.schema';

@Injectable()
export class UserPermissionRepository extends AbstractRepository<UserPermissionDocument> {
  protected readonly logger = new Logger(UserPermissionRepository.name);

  constructor(
    @InjectModel(UserPermissionDocument.name)
    userPermissionModel: Model<UserPermissionDocument>,
  ) {
    super(userPermissionModel);
  }

  async findByUserId(userId: string): Promise<UserPermissionDocument | null> {
    try {
      return await this.model
        .findOne({ userId })
        .lean<UserPermissionDocument>(true);
    } catch (error) {
      this.logger.error(
        `Error finding user permissions for ${userId}: ${error.message}`,
      );
      return null;
    }
  }

  async addPermission(userId: string, permission: string): Promise<void> {
    await this.model.updateOne(
      { userId },
      {
        $addToSet: { permissions: permission },
        $set: {
          'metadata.lastUpdated': new Date(),
        },
      },
      { upsert: true },
    );
  }

  async removePermission(userId: string, permission: string): Promise<void> {
    await this.model.updateOne(
      { userId },
      {
        $pull: { permissions: permission },
        $set: {
          'metadata.lastUpdated': new Date(),
        },
      },
    );
  }

  async addChamaPermissions(
    userId: string,
    chamaId: string,
    permissions: string[],
  ): Promise<void> {
    const userPerms = await this.findByUserId(userId);

    if (!userPerms) {
      // Create new document
      await this.create({
        userId,
        permissions: [],
        chamaPermissions: [{ chamaId, permissions }],
        temporaryPermissions: [],
        inheritedFromRoles: [],
        deniedPermissions: [],
        metadata: {
          lastUpdated: new Date(),
          updatedBy: 'SYSTEM',
        },
      } as any);
      return;
    }

    // Check if chama permissions already exist
    const existingChamaPerms = userPerms.chamaPermissions.find(
      (cp) => cp.chamaId === chamaId,
    );

    if (existingChamaPerms) {
      // Update existing
      await this.model.updateOne(
        { userId, 'chamaPermissions.chamaId': chamaId },
        {
          $addToSet: {
            'chamaPermissions.$.permissions': { $each: permissions },
          },
          $set: {
            'metadata.lastUpdated': new Date(),
          },
        },
      );
    } else {
      // Add new chama permissions
      await this.model.updateOne(
        { userId },
        {
          $push: {
            chamaPermissions: { chamaId, permissions },
          },
          $set: {
            'metadata.lastUpdated': new Date(),
          },
        },
      );
    }
  }

  async removeChamaPermissions(userId: string, chamaId: string): Promise<void> {
    await this.model.updateOne(
      { userId },
      {
        $pull: { chamaPermissions: { chamaId } },
        $set: {
          'metadata.lastUpdated': new Date(),
        },
      },
    );
  }

  async removeResourcePermission(
    userId: string,
    chamaId: string,
    permission: string,
  ): Promise<void> {
    await this.model.updateOne(
      { userId, 'chamaPermissions.chamaId': chamaId },
      {
        $pull: {
          'chamaPermissions.$.permissions': permission,
        },
        $set: {
          'metadata.lastUpdated': new Date(),
        },
      },
    );
  }

  async addTemporaryPermission(
    userId: string,
    tempPermission: TemporaryPermission,
  ): Promise<void> {
    await this.model.updateOne(
      { userId },
      {
        $push: { temporaryPermissions: tempPermission },
        $set: {
          'metadata.lastUpdated': new Date(),
        },
      },
      { upsert: true },
    );
  }

  async removeTemporaryPermission(
    userId: string,
    permission: string,
  ): Promise<void> {
    await this.model.updateOne(
      { userId },
      {
        $pull: { temporaryPermissions: { permission } },
        $set: {
          'metadata.lastUpdated': new Date(),
        },
      },
    );
  }

  async removeExpiredTemporaryPermissions(): Promise<number> {
    const result = await this.model.updateMany(
      {},
      {
        $pull: {
          temporaryPermissions: {
            expiresAt: { $lt: new Date() },
          },
        },
        $set: {
          'metadata.lastUpdated': new Date(),
        },
      },
    );
    return result.modifiedCount;
  }

  async addDeniedPermission(userId: string, permission: string): Promise<void> {
    await this.model.updateOne(
      { userId },
      {
        $addToSet: { deniedPermissions: permission },
        $set: {
          'metadata.lastUpdated': new Date(),
        },
      },
      { upsert: true },
    );
  }

  async removeDeniedPermission(
    userId: string,
    permission: string,
  ): Promise<void> {
    await this.model.updateOne(
      { userId },
      {
        $pull: { deniedPermissions: permission },
        $set: {
          'metadata.lastUpdated': new Date(),
        },
      },
    );
  }

  async deleteAll(): Promise<void> {
    await this.model.deleteMany({});
  }
}
