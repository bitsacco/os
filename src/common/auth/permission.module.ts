import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

// Schemas
import {
  PermissionDocument,
  PermissionSchema,
  UserPermissionDocument,
  UserPermissionSchema,
  RolePermissionDocument,
  RolePermissionSchema,
  PermissionAuditDocument,
  PermissionAuditSchema,
} from './database';

// Repositories
import {
  PermissionRepository,
  UserPermissionRepository,
  RolePermissionRepository,
  PermissionAuditRepository,
} from './repositories';

// Services
import {
  PermissionService,
  PermissionCacheService,
  PermissionAuditService,
  TemporaryPermissionService,
} from './services';

// Guards
import {
  PermissionGuard,
  ResourcePermissionGuard,
  ChamaAccessGuard,
} from './guards';

/**
 * Permission Module
 *
 * Provides permission-based authentication and authorization
 * services, guards, and decorators for the application.
 *
 * This module is global so that guards and services are available
 * throughout the application without explicit imports.
 */
@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(), // For cron jobs in TemporaryPermissionService
    MongooseModule.forFeature([
      { name: PermissionDocument.name, schema: PermissionSchema },
      { name: UserPermissionDocument.name, schema: UserPermissionSchema },
      { name: RolePermissionDocument.name, schema: RolePermissionSchema },
      { name: PermissionAuditDocument.name, schema: PermissionAuditSchema },
    ]),
  ],
  providers: [
    // Repositories
    PermissionRepository,
    UserPermissionRepository,
    RolePermissionRepository,
    PermissionAuditRepository,

    // Services
    PermissionService,
    PermissionCacheService,
    PermissionAuditService,
    TemporaryPermissionService,

    // Guards
    PermissionGuard,
    ResourcePermissionGuard,
    ChamaAccessGuard,
  ],
  exports: [
    // Export services for use in other modules
    PermissionService,
    PermissionCacheService,
    PermissionAuditService,
    TemporaryPermissionService,

    // Export repositories for migration scripts
    PermissionRepository,
    UserPermissionRepository,
    RolePermissionRepository,
    PermissionAuditRepository,

    // Export guards for use in controllers
    PermissionGuard,
    ResourcePermissionGuard,
    ChamaAccessGuard,
  ],
})
export class PermissionModule {}
