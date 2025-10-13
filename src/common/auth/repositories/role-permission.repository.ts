import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepository } from '../../database/abstract.repository';
import { RolePermissionDocument } from '../database/role-permission.schema';
import { Role } from '../../types';

@Injectable()
export class RolePermissionRepository extends AbstractRepository<RolePermissionDocument> {
  protected readonly logger = new Logger(RolePermissionRepository.name);

  constructor(
    @InjectModel(RolePermissionDocument.name)
    rolePermissionModel: Model<RolePermissionDocument>,
  ) {
    super(rolePermissionModel);
  }

  async findByRole(role: Role): Promise<RolePermissionDocument | null> {
    try {
      return await this.model
        .findOne({ role })
        .lean<RolePermissionDocument>(true);
    } catch (error) {
      this.logger.error(
        `Error finding role permissions for ${role}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Batch fetch role permissions for multiple roles (fixes N+1 query problem)
   */
  async findByRoles(roles: Role[]): Promise<RolePermissionDocument[]> {
    try {
      return await this.model
        .find({ role: { $in: roles } })
        .lean<RolePermissionDocument[]>(true);
    } catch (error) {
      this.logger.error(
        `Error finding role permissions for multiple roles: ${error.message}`,
      );
      return [];
    }
  }

  async findAll(): Promise<RolePermissionDocument[]> {
    return this.find({});
  }

  async createMany(
    rolePermissions: Omit<
      RolePermissionDocument,
      '_id' | 'createdAt' | 'updatedAt' | '__v'
    >[],
  ): Promise<void> {
    try {
      await this.model.insertMany(rolePermissions, { ordered: false });
    } catch (error) {
      // Ignore duplicate key errors during seeding
      if (error.code !== 11000) {
        this.logger.error(`Error creating role permissions: ${error.message}`);
        throw error;
      }
    }
  }

  async deleteNonSystem(): Promise<void> {
    await this.model.deleteMany({ isSystem: false });
  }

  async deleteAll(): Promise<void> {
    await this.model.deleteMany({});
  }
}
