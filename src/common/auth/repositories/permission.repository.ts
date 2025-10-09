import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepository } from '../../database/abstract.repository';
import {
  PermissionDocument,
  PermissionCategory,
} from '../database/permission.schema';

@Injectable()
export class PermissionRepository extends AbstractRepository<PermissionDocument> {
  protected readonly logger = new Logger(PermissionRepository.name);

  constructor(
    @InjectModel(PermissionDocument.name)
    permissionModel: Model<PermissionDocument>,
  ) {
    super(permissionModel);
  }

  async findByPermission(
    permission: string,
  ): Promise<PermissionDocument | null> {
    try {
      return await this.model
        .findOne({ permission })
        .lean<PermissionDocument>(true);
    } catch (error) {
      this.logger.error(
        `Error finding permission ${permission}: ${error.message}`,
      );
      return null;
    }
  }

  async findByCategory(
    category: PermissionCategory,
  ): Promise<PermissionDocument[]> {
    return this.find({ category });
  }

  async findAll(): Promise<PermissionDocument[]> {
    return this.find({});
  }

  async createMany(
    permissions: Omit<
      PermissionDocument,
      '_id' | 'createdAt' | 'updatedAt' | '__v'
    >[],
  ): Promise<void> {
    try {
      await this.model.insertMany(permissions, { ordered: false });
    } catch (error) {
      // Ignore duplicate key errors during seeding
      if (error.code !== 11000) {
        this.logger.error(`Error creating permissions: ${error.message}`);
        throw error;
      }
    }
  }

  async deleteAll(): Promise<void> {
    await this.model.deleteMany({});
  }
}
