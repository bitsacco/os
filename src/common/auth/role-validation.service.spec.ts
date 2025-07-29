import { Test, TestingModule } from '@nestjs/testing';
import { RoleValidationService } from './role-validation.service';
import { Role, User } from '../types';
import { ForbiddenException } from '@nestjs/common';

describe('RoleValidationService', () => {
  let service: RoleValidationService;

  // Test user fixtures
  const memberUser: User = {
    id: 'user1',
    roles: [Role.Member],
  } as User;

  const adminUser: User = {
    id: 'user2',
    roles: [Role.Admin],
  } as User;

  const superAdminUser: User = {
    id: 'user3',
    roles: [Role.SuperAdmin],
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoleValidationService],
    }).compile();

    service = module.get<RoleValidationService>(RoleValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateRoleUpdate', () => {
    it('should allow unchanged roles', () => {
      // Arrange
      const currentRoles = [Role.Member];
      const newRoles = [Role.Member];

      // Act & Assert
      expect(() =>
        service.validateRoleUpdate(
          memberUser,
          memberUser.id,
          currentRoles,
          newRoles,
        ),
      ).not.toThrow();
    });

    // Member cannot elevate themselves to Admin
    it('should prevent Members from elevating themselves to Admin', () => {
      // Arrange
      const currentRoles = [Role.Member];
      const newRoles = [Role.Member, Role.Admin];

      // Act & Assert
      expect(() =>
        service.validateRoleUpdate(
          memberUser,
          memberUser.id,
          currentRoles,
          newRoles,
        ),
      ).toThrow(ForbiddenException);
    });

    // Admin cannot promote to SuperAdmin
    it('should prevent Admin from promoting any user to SuperAdmin', () => {
      // Arrange
      const currentRoles = [Role.Member, Role.Admin];
      const newRoles = [Role.Member, Role.Admin, Role.SuperAdmin];
      const targetUserId = 'otherUser';

      // Act & Assert
      expect(() =>
        service.validateRoleUpdate(
          adminUser,
          targetUserId,
          currentRoles,
          newRoles,
        ),
      ).toThrow(ForbiddenException);
    });

    // Only SuperAdmin can grant SuperAdmin
    it('should allow only SuperAdmin to grant SuperAdmin privileges', () => {
      // Arrange
      const currentRoles = [Role.Member, Role.Admin];
      const newRoles = [Role.Member, Role.Admin, Role.SuperAdmin];
      const targetUserId = 'otherUser';

      // Act & Assert
      expect(() =>
        service.validateRoleUpdate(
          superAdminUser,
          targetUserId,
          currentRoles,
          newRoles,
        ),
      ).not.toThrow();
    });

    // Admin can promote Member to Admin
    it('should allow Admin to promote Member to Admin', () => {
      // Arrange
      const currentRoles = [Role.Member];
      const newRoles = [Role.Member, Role.Admin];
      const targetUserId = 'otherUser';

      // Act & Assert
      expect(() =>
        service.validateRoleUpdate(
          adminUser,
          targetUserId,
          currentRoles,
          newRoles,
        ),
      ).not.toThrow();
    });

    // SuperAdmin can grant any role
    it('should allow SuperAdmin to grant any role', () => {
      // Arrange
      const currentRoles = [Role.Member];
      const newRoles = [Role.Member, Role.Admin, Role.SuperAdmin];
      const targetUserId = 'otherUser';

      // Act & Assert
      expect(() =>
        service.validateRoleUpdate(
          superAdminUser,
          targetUserId,
          currentRoles,
          newRoles,
        ),
      ).not.toThrow();
    });
  });
});
