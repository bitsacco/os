import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SuspendedUserGuard } from './suspended-user.guard';
import { Role } from '../types';

describe('SuspendedUserGuard', () => {
  let guard: SuspendedUserGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuspendedUserGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<SuspendedUserGuard>(SuspendedUserGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockContext: ExecutionContext;
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        user: null,
      };

      mockContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as any;
    });

    it('should allow access for public routes', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow access when no user is attached to request', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.user = null;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow access for users without Suspended role', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.user = {
        id: 'user-123',
        roles: [Role.Member],
      };

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow access for Admin users', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.user = {
        id: 'admin-123',
        roles: [Role.Admin],
      };

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow access for SuperAdmin users', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.user = {
        id: 'superadmin-123',
        roles: [Role.SuperAdmin],
      };

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should block access for users with Suspended role', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.user = {
        id: 'suspended-user-123',
        roles: [Role.Member, Role.Suspended],
      };

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Account suspended. You cannot perform transactions at this time.',
      );
    });

    it('should block access for users with only Suspended role', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.user = {
        id: 'suspended-user-456',
        roles: [Role.Suspended],
      };

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Account suspended. You cannot perform transactions at this time.',
      );
    });

    it('should handle user with no roles array', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.user = {
        id: 'user-no-roles',
      };

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle user with empty roles array', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.user = {
        id: 'user-empty-roles',
        roles: [],
      };

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });
});
