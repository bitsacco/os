import { Injectable, Logger } from '@nestjs/common';
import { PermissionRepository } from '../repositories/permission.repository';
import { RolePermissionRepository } from '../repositories/role-permission.repository';
import { UserPermissionRepository } from '../repositories/user-permission.repository';
import { PERMISSIONS } from '../seeds/permissions.seed';
import { ROLE_PERMISSIONS } from '../seeds/role-permissions.seed';

/**
 * Permission System Migration
 *
 * This migration seeds the permission system with:
 * 1. All permission definitions
 * 2. Role-to-permission mappings
 * 3. User permission documents (with inherited roles)
 *
 * Run this migration after deploying the permission system.
 */
@Injectable()
export class SeedPermissionsMigration {
  private readonly logger = new Logger(SeedPermissionsMigration.name);

  constructor(
    private readonly permissionRepo: PermissionRepository,
    private readonly rolePermissionRepo: RolePermissionRepository,
    private readonly userPermissionRepo: UserPermissionRepository,
  ) {}

  /**
   * Execute the migration
   */
  async up(): Promise<void> {
    this.logger.log('Starting permission system migration...');

    try {
      // Step 1: Seed all permission definitions
      await this.seedPermissions();

      // Step 2: Seed role-to-permission mappings
      await this.seedRolePermissions();

      this.logger.log('Permission system migration completed successfully!');
    } catch (error) {
      this.logger.error('Migration failed:', error.message, error.stack);
      throw error;
    }
  }

  /**
   * Rollback the migration
   */
  async down(): Promise<void> {
    this.logger.log('Rolling back permission system migration...');

    try {
      // Delete all permissions and role permissions
      await this.permissionRepo.deleteAll();
      await this.rolePermissionRepo.deleteAll();
      await this.userPermissionRepo.deleteAll();

      this.logger.log('Permission system rollback completed successfully!');
    } catch (error) {
      this.logger.error('Rollback failed:', error.message, error.stack);
      throw error;
    }
  }

  /**
   * Seed all permission definitions
   */
  private async seedPermissions(): Promise<void> {
    this.logger.log(`Seeding ${PERMISSIONS.length} permissions...`);

    try {
      await this.permissionRepo.createMany(
        PERMISSIONS.map((perm) => ({
          ...perm,
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            isDeprecated: false,
          },
        })) as any,
      );

      this.logger.log(`Successfully seeded ${PERMISSIONS.length} permissions`);
    } catch (error) {
      // If error is duplicate key (11000), ignore it
      if (error.code === 11000) {
        this.logger.warn('Permissions already exist, skipping...');
      } else {
        throw error;
      }
    }
  }

  /**
   * Seed role-to-permission mappings
   */
  private async seedRolePermissions(): Promise<void> {
    const roleMappings = Object.values(ROLE_PERMISSIONS);
    this.logger.log(
      `Seeding ${roleMappings.length} role-permission mappings...`,
    );

    try {
      await this.rolePermissionRepo.createMany(
        roleMappings.map((mapping) => ({
          ...mapping,
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })) as any,
      );

      this.logger.log(
        `Successfully seeded ${roleMappings.length} role-permission mappings`,
      );
    } catch (error) {
      // If error is duplicate key (11000), ignore it
      if (error.code === 11000) {
        this.logger.warn('Role permissions already exist, skipping...');
      } else {
        throw error;
      }
    }
  }

  /**
   * Create user_permissions for all existing users
   *
   * This method should be called after the initial migration
   * to create permission documents for all existing users.
   *
   * Note: This requires the UsersService to be injected.
   */
  async migrateExistingUsers(
    users: Array<{ id: string; roles: number[] }>,
  ): Promise<void> {
    this.logger.log(`Migrating ${users.length} existing users...`);

    for (const user of users) {
      try {
        // Create user permission document with inherited roles
        await this.userPermissionRepo.create({
          userId: user.id,
          permissions: [],
          chamaPermissions: [],
          temporaryPermissions: [],
          inheritedFromRoles: user.roles,
          deniedPermissions: [],
          metadata: {
            lastUpdated: new Date(),
            updatedBy: 'SYSTEM_MIGRATION',
          },
        } as any);

        this.logger.debug(`Created permission document for user ${user.id}`);
      } catch (error) {
        if (error.code === 11000) {
          // User already has permission document, skip
          this.logger.debug(`User ${user.id} already has permission document`);
        } else {
          this.logger.error(
            `Failed to create permission document for user ${user.id}:`,
            error.message,
          );
        }
      }
    }

    this.logger.log(`Successfully migrated ${users.length} users`);
  }
}
