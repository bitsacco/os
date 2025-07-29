import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { JwtAuthGuard, JwtAuthStrategy, Public } from './jwt.auth';
import { AuthTokenPayload, Role, User } from '../types';
import { UsersService } from '../users';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;
  let reflector: Reflector;

  const mockUser: User = {
    id: 'test-user-id',
    phone: {
      number: '+1234567890',
      verified: true,
    },
    roles: [Role.Member],
  };

  const mockTokenPayload: AuthTokenPayload = {
    user: mockUser,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
    nbf: Math.floor(Date.now() / 1000),
    iss: 'bitsacco-auth-service',
    aud: 'bitsacco-api',
    jti: 'test-token-id',
  };

  const mockJwt = 'valid.jwt.token';

  beforeEach(async () => {
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
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtService = module.get<JwtService>(JwtService);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should throw UnauthorizedException when no token is present', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: {},
            headers: {},
          }),
        }),
        getHandler: () => ({}),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        UnauthorizedException,
      );
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
      expect(reflector.get).toHaveBeenCalledWith(
        'isPublic',
        expect.any(Object),
      );
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

    it('should throw UnauthorizedException when token is expired', () => {
      jest.spyOn(jwtService, 'verify').mockReturnValueOnce({
        user: mockUser,
        exp: Math.floor(Date.now() / 1000) - 60, // Expired
        iat: Math.floor(Date.now() / 1000) - 3600,
        nbf: Math.floor(Date.now() / 1000) - 3600,
        iss: 'bitsacco-auth-service',
        aud: 'bitsacco-api',
        jti: 'test-token-id',
      });

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: { Authentication: mockJwt },
          }),
        }),
        getHandler: () => ({}),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token verification fails', () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: { Authentication: mockJwt },
          }),
        }),
        getHandler: () => ({}),
      };

      expect(() => guard.canActivate(mockContext as any)).toThrow(
        UnauthorizedException,
      );
    });
  });
});

describe('JwtAuthStrategy', () => {
  let strategy: JwtAuthStrategy;
  let usersService: UsersService;

  // Redefine the mockUser since the variable scope is different for this describe block
  const mockUser: User = {
    id: 'test-user-id',
    phone: {
      number: '+1234567890',
      verified: true,
    },
    roles: [Role.Member],
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
        exp: Math.floor(Date.now() / 1000) + 3600, // Optional in interface, but included in tests
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000),
        iss: 'bitsacco-auth-service',
        aud: 'bitsacco-api',
        jti: 'test-token-id',
      };

      const result = await strategy.validate(authTokenPayload);

      expect(result).toEqual(mockUser);
      expect(usersService.findUser).toHaveBeenCalledWith({ id: mockUser.id });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Create auth token payload for this test
      const authTokenPayload = {
        user: mockUser,
        exp: Math.floor(Date.now() / 1000) + 3600, // Optional in interface, but included in tests
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000),
        iss: 'bitsacco-auth-service',
        aud: 'bitsacco-api',
        jti: 'test-token-id',
      };

      jest
        .spyOn(usersService, 'findUser')
        .mockRejectedValueOnce(new Error('User not found'));

      await expect(strategy.validate(authTokenPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
