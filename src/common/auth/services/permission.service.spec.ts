import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionRepository } from '../repositories/permission.repository';
import { UserPermissionRepository } from '../repositories/user-permission.repository';
import { RolePermissionRepository } from '../repositories/role-permission.repository';
import { PermissionCacheService } from './permission-cache.service';
import { PermissionAuditService } from './permission-audit.service';
import { Role } from '../../types';

describe('PermissionService', () => {
  let service: PermissionService;
  let permissionRepo: jest.Mocked<PermissionRepository>;
  let userPermissionRepo: jest.Mocked<UserPermissionRepository>;
  let rolePermissionRepo: jest.Mocked<RolePermissionRepository>;
  let cacheService: jest.Mocked<PermissionCacheService>;
  let auditService: jest.Mocked<PermissionAuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: PermissionRepository,
          useValue: {
            findByPermission: jest.fn(),
          },
        },
        {
          provide: UserPermissionRepository,
          useValue: {
            findByUserId: jest.fn(),
            addPermission: jest.fn(),
            removePermission: jest.fn(),
            addTemporaryPermission: jest.fn(),
            addChamaPermissions: jest.fn(),
            removeResourcePermission: jest.fn(),
            addDeniedPermission: jest.fn(),
            removeDeniedPermission: jest.fn(),
          },
        },
        {
          provide: RolePermissionRepository,
          useValue: {
            findByRole: jest.fn(),
            findByRoles: jest.fn(),
          },
        },
        {
          provide: PermissionCacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            invalidate: jest.fn(),
            invalidatePermission: jest.fn(),
          },
        },
        {
          provide: PermissionAuditService,
          useValue: {
            logGrant: jest.fn(),
            logRevoke: jest.fn(),
            logCheck: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
    permissionRepo = module.get(PermissionRepository);
    userPermissionRepo = module.get(UserPermissionRepository);
    rolePermissionRepo = module.get(RolePermissionRepository);
    cacheService = module.get(PermissionCacheService);
    auditService = module.get(PermissionAuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hasPermission', () => {
    const userId = 'user123';
    const permission = 'user:read:own';

    it('should check cache first and return cached result', async () => {
      cacheService.get.mockReturnValue(true);

      const result = await service.hasPermission(userId, permission);

      expect(result).toBe(true);
      expect(cacheService.get).toHaveBeenCalledWith(
        userId,
        permission,
        undefined,
      );
      expect(userPermissionRepo.findByUserId).not.toHaveBeenCalled();
    });

    it('should deny if permission is explicitly denied', async () => {
      cacheService.get.mockReturnValue(null);
      userPermissionRepo.findByUserId.mockResolvedValue({
        userId,
        permissions: [],
        deniedPermissions: [permission],
        inheritedFromRoles: [],
        temporaryPermissions: [],
        chamaPermissions: [],
      } as any);

      const result = await service.hasPermission(userId, permission);

      expect(result).toBe(false);
      expect(cacheService.set).toHaveBeenCalledWith(
        userId,
        permission,
        false,
        undefined,
      );
      expect(auditService.logCheck).toHaveBeenCalledWith({
        userId,
        permission,
        result: false,
      });
    });

    it('should grant if user has temporary permission', async () => {
      cacheService.get.mockReturnValue(null);
      const futureDate = new Date(Date.now() + 10000);
      userPermissionRepo.findByUserId.mockResolvedValue({
        userId,
        permissions: [],
        deniedPermissions: [],
        temporaryPermissions: [
          {
            permission,
            expiresAt: futureDate,
            grantedBy: 'admin',
          },
        ],
        inheritedFromRoles: [],
        chamaPermissions: [],
      } as any);

      const result = await service.hasPermission(userId, permission);

      expect(result).toBe(true);
      expect(cacheService.set).toHaveBeenCalledWith(
        userId,
        permission,
        true,
        undefined,
      );
    });

    it('should grant if user has direct permission', async () => {
      cacheService.get.mockReturnValue(null);
      userPermissionRepo.findByUserId.mockResolvedValue({
        userId,
        permissions: [permission],
        deniedPermissions: [],
        temporaryPermissions: [],
        inheritedFromRoles: [],
        chamaPermissions: [],
      } as any);

      const result = await service.hasPermission(userId, permission);

      expect(result).toBe(true);
      expect(cacheService.set).toHaveBeenCalledWith(
        userId,
        permission,
        true,
        undefined,
      );
    });

    it('should grant if user has role-based permission', async () => {
      cacheService.get.mockReturnValue(null);
      userPermissionRepo.findByUserId.mockResolvedValue({
        userId,
        permissions: [],
        deniedPermissions: [],
        temporaryPermissions: [],
        inheritedFromRoles: [Role.Admin],
        chamaPermissions: [],
      } as any);

      rolePermissionRepo.findByRoles.mockResolvedValue([
        {
          role: Role.Admin,
          permissions: [permission],
        } as any,
      ]);

      const result = await service.hasPermission(userId, permission);

      expect(result).toBe(true);
      expect(rolePermissionRepo.findByRoles).toHaveBeenCalledWith([Role.Admin]);
    });

    it('should fail secure on errors', async () => {
      cacheService.get.mockReturnValue(null);
      userPermissionRepo.findByUserId.mockRejectedValue(new Error('DB error'));

      const result = await service.hasPermission(userId, permission);

      expect(result).toBe(false);
    });
  });

  describe('grantPermission', () => {
    const userId = 'user123';
    const permission = 'user:read:own';
    const grantedBy = 'admin';

    it('should validate permission format', async () => {
      await expect(
        service.grantPermission(userId, 'invalid-format!', grantedBy),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate permission exists', async () => {
      permissionRepo.findByPermission.mockResolvedValue(null);

      await expect(
        service.grantPermission(userId, permission, grantedBy),
      ).rejects.toThrow(BadRequestException);
    });

    it('should clear cache before database update', async () => {
      permissionRepo.findByPermission.mockResolvedValue({ permission } as any);
      const callOrder: string[] = [];

      cacheService.invalidate.mockImplementation(() => {
        callOrder.push('cache');
      });

      userPermissionRepo.addPermission.mockImplementation(async () => {
        callOrder.push('db');
      });

      await service.grantPermission(userId, permission, grantedBy);

      expect(callOrder).toEqual(['cache', 'db']);
      expect(auditService.logGrant).toHaveBeenCalled();
    });

    it('should handle temporary permissions', async () => {
      permissionRepo.findByPermission.mockResolvedValue({ permission } as any);
      const expiresAt = new Date();

      await service.grantPermission(userId, permission, grantedBy, {
        expiresAt,
        reason: 'test',
      });

      expect(userPermissionRepo.addTemporaryPermission).toHaveBeenCalledWith(
        userId,
        {
          permission,
          expiresAt,
          grantedBy,
          reason: 'test',
        },
      );
    });

    it('should handle resource-specific permissions', async () => {
      permissionRepo.findByPermission.mockResolvedValue({ permission } as any);
      const resourceId = 'chama123';

      await service.grantPermission(userId, permission, grantedBy, {
        resourceId,
      });

      expect(userPermissionRepo.addChamaPermissions).toHaveBeenCalledWith(
        userId,
        resourceId,
        [permission],
      );
    });
  });

  describe('revokePermission', () => {
    const userId = 'user123';
    const permission = 'user:read:own';
    const revokedBy = 'admin';

    it('should clear cache before database update', async () => {
      const callOrder: string[] = [];

      cacheService.invalidate.mockImplementation(() => {
        callOrder.push('cache');
      });

      userPermissionRepo.removePermission.mockImplementation(async () => {
        callOrder.push('db');
      });

      await service.revokePermission(userId, permission, revokedBy);

      expect(callOrder).toEqual(['cache', 'db']);
      expect(auditService.logRevoke).toHaveBeenCalled();
    });

    it('should handle resource-specific revocation', async () => {
      const resourceId = 'chama123';

      await service.revokePermission(userId, permission, revokedBy, resourceId);

      expect(userPermissionRepo.removeResourcePermission).toHaveBeenCalledWith(
        userId,
        resourceId,
        permission,
      );
    });
  });

  describe('N+1 query prevention', () => {
    it('should batch fetch role permissions', async () => {
      const userId = 'user123';
      const permission = 'user:read:own';

      cacheService.get.mockReturnValue(null);
      userPermissionRepo.findByUserId.mockResolvedValue({
        userId,
        permissions: [],
        deniedPermissions: [],
        temporaryPermissions: [],
        inheritedFromRoles: [Role.User, Role.Admin],
        chamaPermissions: [],
      } as any);

      rolePermissionRepo.findByRoles.mockResolvedValue([
        { role: Role.User, permissions: ['user:read:own'] },
        { role: Role.Admin, permissions: ['admin:*'] },
      ] as any);

      await service.hasPermission(userId, permission);

      // Should call findByRoles once with array, not multiple findByRole calls
      expect(rolePermissionRepo.findByRoles).toHaveBeenCalledTimes(1);
      expect(rolePermissionRepo.findByRoles).toHaveBeenCalledWith([
        Role.User,
        Role.Admin,
      ]);
    });
  });
});
