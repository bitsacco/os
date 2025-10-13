import { Role } from '../../types';
import { ChamaMemberRole } from '../../types/chama';

/**
 * Default role-to-permission mappings
 */
export const ROLE_PERMISSIONS = {
  /**
   * SuperAdmin - Full system access
   */
  [Role.SuperAdmin]: {
    role: Role.SuperAdmin,
    permissions: ['*'], // Wildcard - all permissions
    description: 'Super Administrator with full system access',
    isSystem: true,
  },

  /**
   * Admin - Platform administration
   */
  [Role.Admin]: {
    role: Role.Admin,
    permissions: [
      // User management
      'user:read:any',
      'user:update:any',
      'user:search',

      // Chama management
      'chama:read:any',
      'chama:update:any',
      'chama:member:add',
      'chama:member:remove',

      // Transaction oversight
      'transaction:read:any',
      'wallet:read:any',

      // Admin features
      'admin:dashboard:access',
      'admin:metrics:view',
      'admin:users:manage',
      'admin:chamas:manage',
      'admin:transactions:view',
    ],
    description: 'Platform Administrator',
    isSystem: true,
  },

  /**
   * Member - Regular user
   */
  [Role.Member]: {
    role: Role.Member,
    permissions: [
      // User permissions
      'user:create',
      'user:read:own',
      'user:update:own',
      'user:delete:own',
      'user:search',
      'user:roles:read:own',

      // Chama permissions
      'chama:create',
      'chama:read:own',
      'chama:read:invited',
      'chama:list:own',
      'chama:search',
      'chama:join:public',
      'chama:join:invited',

      // Wallet & transactions
      'wallet:read:own',
      'wallet:deposit:own',
      'wallet:withdraw:own',
      'transaction:create:own',
      'transaction:read:own',
      'transaction:update:own',
      'transaction:cancel:own',

      // Personal savings
      'personal:wallet:create',
      'personal:wallet:read:own',
      'personal:wallet:update:own',
      'personal:wallet:delete:own',
      'personal:target:create',
      'personal:target:update:own',
      'personal:target:complete',
      'personal:locked:create',
      'personal:locked:update:own',
      'personal:locked:withdraw_early',
      'personal:analytics:read:own',

      // Shares
      'shares:offer:create',
      'shares:offer:read',
      'shares:offer:update:own',
      'shares:offer:cancel:own',
      'shares:subscribe',
      'shares:transfer:own',
      'shares:read:own',

      // Notifications
      'notification:read:own',
      'notification:update:own',
      'notification:delete:own',
      'notification:preferences:update:own',
    ],
    description: 'Regular User',
    isSystem: true,
  },
};

/**
 * Chama-specific role permissions
 * These are applied per-chama basis
 */
export const CHAMA_ROLE_PERMISSIONS = {
  [ChamaMemberRole.Admin]: [
    'chama:update:own',
    'chama:delete:own',
    'chama:member:add',
    'chama:member:remove',
    'chama:member:update_roles',
    'chama:invite:send',
    'chama:invite:revoke',
    'chama:invite:manage',
    'wallet:read:chama',
    'wallet:deposit:chama',
    'wallet:withdraw:chama',
    'wallet:withdraw:approve',
    'transaction:read:chama',
    'transaction:create:chama',
    'transaction:update:chama',
  ],

  [ChamaMemberRole.Member]: [
    'chama:read:own',
    'wallet:read:chama',
    'wallet:deposit:chama',
    'wallet:withdraw:chama',
    'transaction:read:chama',
    'transaction:create:chama',
  ],

  [ChamaMemberRole.ExternalAdmin]: [
    'chama:read:own',
    'wallet:read:chama',
    'transaction:read:chama',
  ],
};
