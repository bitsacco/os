import { SetMetadata } from '@nestjs/common';

export interface PermissionConfig {
  permissions: string[];
  requireAll?: boolean;
  resourceType?: string;
  contextField?: string;
}

export interface ResourcePermissionConfig {
  paramName: string;
  ownPermission: string;
  anyPermission?: string;
  userIdField?: string;
}

export enum ChamaAccessLevel {
  NONE = 'NONE',
  PREVIEW_INVITED = 'PREVIEW',
  FULL_MEMBER = 'FULL_MEMBER',
  FULL_ADMIN = 'FULL_ADMIN',
}

export interface ChamaAccessConfig {
  chamaIdField: string;
  requiredLevel: ChamaAccessLevel;
}

/**
 * Require specific permissions (AND logic by default)
 *
 * @example
 * @UseGuards(JwtAuthGuard, PermissionGuard)
 * @RequirePermissions(['chama:update:own'])
 * async updateChama() {}
 */
export const RequirePermissions = (
  permissions: string[],
  options?: {
    requireAll?: boolean;
    resourceType?: string;
    contextField?: string;
  },
) => {
  const config: PermissionConfig = {
    permissions,
    requireAll: options?.requireAll ?? true,
    resourceType: options?.resourceType,
    contextField: options?.contextField,
  };
  return SetMetadata('permissions', config);
};

/**
 * Require permission on a specific resource
 *
 * @example
 * @UseGuards(JwtAuthGuard, PermissionGuard)
 * @RequireResourcePermission('chama', 'update', { contextField: 'chamaId' })
 * async updateChama() {}
 */
export const RequireResourcePermission = (
  resourceType: string,
  action: string,
  options?: { contextField?: string },
) => {
  const permission = `${resourceType}:${action}`;
  const config: PermissionConfig = {
    permissions: [permission],
    requireAll: true,
    resourceType,
    contextField: options?.contextField || `${resourceType}Id`,
  };
  return SetMetadata('permissions', config);
};

/**
 * Require ANY of the permissions (OR logic)
 *
 * @example
 * @UseGuards(JwtAuthGuard, PermissionGuard)
 * @RequireAnyPermission(['chama:read:own', 'chama:read:any'])
 * async getChama() {}
 */
export const RequireAnyPermission = (permissions: string[]) => {
  const config: PermissionConfig = {
    permissions,
    requireAll: false,
  };
  return SetMetadata('permissions', config);
};

/**
 * Require ALL permissions (AND logic, explicit)
 *
 * @example
 * @UseGuards(JwtAuthGuard, PermissionGuard)
 * @RequireAllPermissions(['user:update:any', 'user:roles:update:any'])
 * async updateUserRoles() {}
 */
export const RequireAllPermissions = (permissions: string[]) => {
  const config: PermissionConfig = {
    permissions,
    requireAll: true,
  };
  return SetMetadata('permissions', config);
};

/**
 * Require resource ownership (user:read:own or user:read:any)
 *
 * @example
 * @UseGuards(JwtAuthGuard, ResourcePermissionGuard)
 * @RequireResourceOwnership('user', 'update', 'userId')
 * async updateUser(@Param('userId') userId: string) {}
 */
export const RequireResourceOwnership = (
  resourceType: string,
  action: string,
  paramName: string,
) => {
  return SetMetadata('resource_permission', {
    paramName,
    ownPermission: `${resourceType}:${action}:own`,
    anyPermission: `${resourceType}:${action}:any`,
  } as ResourcePermissionConfig);
};

/**
 * Require chama access at a specific level
 *
 * @example
 * // Allow invitees to preview
 * @UseGuards(JwtAuthGuard, ChamaAccessGuard)
 * @RequireChamaAccess(ChamaAccessLevel.PREVIEW_INVITED)
 * async getChamaPreview() {}
 *
 * // Require full membership
 * @UseGuards(JwtAuthGuard, ChamaAccessGuard)
 * @RequireChamaAccess(ChamaAccessLevel.FULL_MEMBER)
 * async getChamaMembers() {}
 */
export const RequireChamaAccess = (
  requiredLevel: ChamaAccessLevel,
  chamaIdField = 'chamaId',
) => {
  return SetMetadata('chama_access', {
    chamaIdField,
    requiredLevel,
  } as ChamaAccessConfig);
};
