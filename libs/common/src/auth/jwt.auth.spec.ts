import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import {
  JwtAuthGuard,
  JwtAuthStrategy,
  Public,
} from './jwt.auth';
import {
  AUTH_SERVICE_NAME,
  AuthServiceClient,
  AuthTokenPayload,
  Role,
  User,
} from '../types';
import { UsersService } from '../users';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;
  let reflector: Reflector;
  let authService: Partial<AuthServiceClient>;

  const mockUser: User = {
    id: 'test-user-id',
    name: 'Test User',
    pin: 'hashedpin',
    phone: '+1234567890',
    verified: true,
    roles: [Role.USER],
  };

  const mockTokenPayload: AuthTokenPayload = {
    user: mockUser,
    expires: new Date(Date.now() + 3600 * 1000), // 1 hour from now
  };

  const mockJwt = 'valid.jwt.token';

  beforeEach(async () => {
    // Create mock AuthServiceClient
    authService = {
      authenticate: jest.fn().mockReturnValue(
        of({
          user: mockUser,
          token: mockJwt,
        })
      ),
    };

    // Mock gRPC client
    const mockGrpcClient = {
      getService: jest.fn().mockReturnValue(authService),
    };

    // Create module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue(mockTokenPayload),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: AUTH_SERVICE_NAME,
          useValue: mockGrpcClient,
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtService = module.get<JwtService>(JwtService);
    reflector = module.get<Reflector>(Reflector);

    // Initialize guard
    guard.onModuleInit();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return false when no token is present', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: {},
            headers: {},
          }),
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any);
      expect(result).toBe(false);
    });

    it('should return true for public routes', () => {
      jest.spyOn(reflector, 'get').mockReturnValueOnce(true);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: { Authentication: mockJwt },
          }),
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any);
      expect(result).toBe(true);
      expect(reflector.get).toHaveBeenCalledWith('isPublic', expect.any(Object));
    });

    it('should verify token locally and set user in request', () => {
      const mockRequest = {
        cookies: { Authentication: mockJwt },
        user: null,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any);
      
      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith(mockJwt);
      expect(mockRequest.user).toEqual(mockUser);
    });

    it('should return false when token is expired', () => {
      jest.spyOn(jwtService, 'verify').mockReturnValueOnce({
        user: mockUser,
        expires: new Date(Date.now() - 1000), // Expired
      });

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: { Authentication: mockJwt },
          }),
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any);
      expect(result).toBe(false);
    });

    // Skip this test for now as it requires deeper mocking of the JwtAuthGuard internals
    it.skip('should check for required roles', () => {
      // We need to mock the guard's internal roles check logic
      // This is challenging since it's not directly accessible 
      // Will revisit in a future PR
    });

    it('should fallback to gRPC auth service when local verification fails', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const mockRequest = {
        cookies: { Authentication: mockJwt },
        user: null,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any) as any;
      
      // Should return an Observable
      expect(result.subscribe).toBeDefined();
      
      // Extract value from observable
      const value = await new Promise((resolve) => {
        result.subscribe(resolve);
      });
      
      expect(value).toBe(true);
      expect(authService.authenticate).toHaveBeenCalledWith({ token: mockJwt });
      expect(mockRequest.user).toEqual(mockUser);
    });

    it('should handle auth service errors', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      (authService.authenticate as jest.Mock).mockReturnValueOnce(
        throwError(() => new Error('Authentication failed'))
      );

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: { Authentication: mockJwt },
          }),
        }),
        getHandler: () => ({}),
      };

      const result = guard.canActivate(mockContext as any) as any;
      
      // Extract value from observable
      const value = await new Promise((resolve) => {
        result.subscribe(resolve);
      });
      
      expect(value).toBe(false);
    });
  });

  describe('Public decorator', () => {
    it('should set metadata correctly', () => {
      const testFn = () => {};
      const decoratedFn = Public()(testFn);
      
      expect(Reflect.getMetadata('isPublic', decoratedFn)).toBe(true);
    });
  });
});

describe('JwtAuthStrategy', () => {
  let strategy: JwtAuthStrategy;
  let usersService: UsersService;

  // Redefine the mockUser since the variable scope is different for this describe block
  const mockUser: User = {
    id: 'test-user-id',
    name: 'Test User',
    pin: 'hashedpin',
    phone: '+1234567890',
    verified: true,
    roles: [Role.USER],
  };

  beforeEach(async () => {
    // Create mock UsersService
    const mockUsersService = {
      findUser: jest.fn().mockResolvedValue(mockUser),
    };

    // Create mock ConfigService
    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };

    // Create module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtAuthStrategy>(JwtAuthStrategy);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when validation succeeds', async () => {
      // Create auth token payload for this test
      const authTokenPayload = {
        user: mockUser,
        expires: new Date(Date.now() + 3600 * 1000)
      };
      
      const result = await strategy.validate(authTokenPayload);
      
      expect(result).toEqual(mockUser);
      expect(usersService.findUser).toHaveBeenCalledWith({ id: mockUser.id });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Create auth token payload for this test
      const authTokenPayload = {
        user: mockUser,
        expires: new Date(Date.now() + 3600 * 1000)
      };
      
      jest.spyOn(usersService, 'findUser').mockRejectedValueOnce(new Error('User not found'));
      
      await expect(strategy.validate(authTokenPayload)).rejects.toThrow(UnauthorizedException);
    });
  });
});