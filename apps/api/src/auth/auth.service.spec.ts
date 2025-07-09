import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  UsersService,
  TokenResponse,
  User,
  Role,
  RegisterUserRequestDto,
} from '@bitsacco/common';
import { AuthService } from './auth.service';
import { TokenService } from './tokens/token.service';
import { AuthMetricsService } from './metrics/auth.metrics';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { SmsService } from '../sms/sms.service';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let tokenService: TokenService;
  let smsService: SmsService;
  let metricsService: AuthMetricsService;
  let rateLimitService: RateLimitService;

  const mockUser: User = {
    id: 'test-user-id',
    profile: {
      name: 'Test User',
    },
    phone: {
      number: '+1234567890',
      verified: true,
    },
    roles: [],
  };

  const mockTokens: TokenResponse = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
  };

  beforeEach(async () => {
    // Create mock for SmsService
    const mockSmsService = {
      sendSms: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock for UsersService
    const mockUsersService = {
      validateUser: jest.fn(),
      registerUser: jest.fn(),
      verifyUser: jest.fn(),
      findUser: jest.fn().mockResolvedValue(mockUser),
    };

    // Create mock for TokenService
    const mockTokenService = {
      generateTokens: jest.fn().mockResolvedValue(mockTokens),
      verifyAccessToken: jest.fn(),
      refreshTokens: jest.fn().mockResolvedValue(mockTokens),
      revokeToken: jest.fn().mockResolvedValue(true),
      revokeAllUserTokens: jest.fn().mockResolvedValue(true),
    };

    // Create mock for AuthMetricsService
    const mockMetricsService = {
      recordLoginMetric: jest.fn(),
      recordRegisterMetric: jest.fn(),
      recordVerifyMetric: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({}),
      resetMetrics: jest.fn(),
    };

    // Create mock for RateLimitService
    const mockRateLimitService = {
      checkRateLimit: jest.fn().mockImplementation(() => {
        // Return a successful rate limit result
        return Promise.resolve();
      }),
      resetRateLimit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
        {
          provide: AuthMetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: RateLimitService,
          useValue: mockRateLimitService,
        },
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    tokenService = module.get<TokenService>(TokenService);
    metricsService = module.get<AuthMetricsService>(AuthMetricsService);
    rateLimitService = module.get<RateLimitService>(RateLimitService);
    smsService = module.get<SmsService>(SmsService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('loginUser', () => {
    it('should return user and tokens when authorized', async () => {
      jest.spyOn(usersService, 'validateUser').mockResolvedValue({
        user: mockUser,
        authorized: true,
      });

      const loginRequest = {
        phone: '+1234567890',
        pin: '1234',
      };

      const result = await authService.loginUser(loginRequest);

      expect(result).toEqual({
        user: mockUser,
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
      });

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        loginRequest.phone,
      );
      expect(rateLimitService.resetRateLimit).toHaveBeenCalledWith(
        loginRequest.phone,
      );
      expect(usersService.validateUser).toHaveBeenCalledWith(loginRequest);
      expect(tokenService.generateTokens).toHaveBeenCalledWith(mockUser);
    });

    it('should return only user when not authorized', async () => {
      jest.spyOn(usersService, 'validateUser').mockResolvedValue({
        user: mockUser,
        authorized: false,
      });

      const loginRequest = {
        phone: '+1234567890',
        pin: '1234',
      };

      const result = await authService.loginUser(loginRequest);

      expect(result).toEqual({
        user: mockUser,
      });

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        loginRequest.phone,
      );
      expect(usersService.validateUser).toHaveBeenCalledWith(loginRequest);
      expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when validation fails', async () => {
      jest
        .spyOn(usersService, 'validateUser')
        .mockRejectedValue(new Error('Invalid credentials'));

      const loginRequest = {
        phone: '+1234567890',
        pin: '1234',
      };

      await expect(authService.loginUser(loginRequest)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        loginRequest.phone,
      );
    });

    it('should handle rate limiting failure', async () => {
      jest
        .spyOn(rateLimitService, 'checkRateLimit')
        .mockRejectedValue(
          new UnauthorizedException('Too many authentication attempts'),
        );

      const loginRequest = {
        phone: '+1234567890',
        pin: '1234',
      };

      await expect(authService.loginUser(loginRequest)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        loginRequest.phone,
      );
      expect(usersService.validateUser).not.toHaveBeenCalled();
    });
  });

  describe('registerUser', () => {
    it('should return user when registration is successful', async () => {
      jest.spyOn(usersService, 'registerUser').mockResolvedValue({
        user: mockUser,
        authorized: false,
        otp: '123456',
      });

      const registerRequest: RegisterUserRequestDto = {
        phone: '+1234567890',
        pin: '123456',
        roles: [Role.Member],
      };

      const result = await authService.registerUser(registerRequest);

      expect(result).toEqual({
        user: mockUser,
      });

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        registerRequest.phone,
      );
      expect(usersService.registerUser).toHaveBeenCalledWith(registerRequest);
      // Should send OTP if not authorized
      expect(smsService.sendSms).toHaveBeenCalled();
    });

    it('should not send OTP when user is already authorized', async () => {
      jest.spyOn(usersService, 'registerUser').mockResolvedValue({
        user: mockUser,
        authorized: true,
        otp: '123456',
      });

      const registerRequest: RegisterUserRequestDto = {
        phone: '+1234567890',
        pin: '123456',
        roles: [Role.Member],
      };

      const result = await authService.registerUser(registerRequest);

      expect(result).toEqual({
        user: mockUser,
      });

      expect(usersService.registerUser).toHaveBeenCalledWith(registerRequest);
      expect(smsService.sendSms).not.toHaveBeenCalled();
    });

    it('should handle SMS sending failures gracefully', async () => {
      jest.spyOn(usersService, 'registerUser').mockResolvedValue({
        user: mockUser,
        authorized: false,
        otp: '123456',
      });

      // Mock SMS failure
      (smsService.sendSms as jest.Mock).mockRejectedValue(
        new Error('SMS sending failed'),
      );

      const registerRequest: RegisterUserRequestDto = {
        phone: '+1234567890',
        pin: '123456',
        roles: [Role.Member],
      };

      // Should still return successfully despite SMS failure
      const result = await authService.registerUser(registerRequest);

      expect(result).toEqual({
        user: mockUser,
      });
    });

    it('should throw InternalServerErrorException when registration fails', async () => {
      jest
        .spyOn(usersService, 'registerUser')
        .mockRejectedValue(new Error('Registration failed'));

      const registerRequest: RegisterUserRequestDto = {
        phone: '+1234567890',
        pin: '1234',
        roles: [Role.Member],
      };

      await expect(authService.registerUser(registerRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('verifyUser', () => {
    it('should return user and tokens when verification is successful', async () => {
      jest.spyOn(usersService, 'verifyUser').mockResolvedValue({
        user: mockUser,
        authorized: true,
      });

      const verifyRequest = {
        phone: '+1234567890',
        otp: '123456',
      };

      const result = await authService.verifyUser(verifyRequest);

      expect(result).toEqual({
        user: mockUser,
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
      });

      expect(usersService.verifyUser).toHaveBeenCalledWith(verifyRequest);
      expect(tokenService.generateTokens).toHaveBeenCalledWith(mockUser);
    });

    it('should send new OTP when verification requires another step', async () => {
      const preAuth = {
        user: mockUser,
        authorized: false,
        otp: '654321',
      };

      jest.spyOn(usersService, 'verifyUser').mockResolvedValue(preAuth);

      const verifyRequest = {
        phone: '+1234567890',
        otp: '123456',
      };

      const result = await authService.verifyUser(verifyRequest);

      expect(result).toEqual({
        user: mockUser,
      });

      expect(usersService.verifyUser).toHaveBeenCalledWith(verifyRequest);
      expect(smsService.sendSms).toHaveBeenCalled();
      expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when verification fails', async () => {
      jest
        .spyOn(usersService, 'verifyUser')
        .mockRejectedValue(new Error('Verification failed'));

      const verifyRequest = {
        phone: '+1234567890',
        otp: '123456',
      };

      await expect(authService.verifyUser(verifyRequest)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('authenticate', () => {
    it('should return user and token when authentication is successful', async () => {
      const tokenPayload = {
        user: mockUser,
        expires: new Date(Date.now() + 3600 * 1000), // 1 hour from now
      };

      jest
        .spyOn(tokenService, 'verifyAccessToken')
        .mockResolvedValue(tokenPayload);

      const authRequest = {
        accessToken: 'valid-token',
      };

      const result = await authService.authenticate(authRequest);

      expect(result).toEqual({
        user: mockUser,
        accessToken: 'valid-token',
      });

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(usersService.findUser).toHaveBeenCalledWith({ id: mockUser.id });
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      // The JWT service now handles token expiration automatically
      // So we should simulate a rejection from the verifyAccessToken method
      jest
        .spyOn(tokenService, 'verifyAccessToken')
        .mockRejectedValue(new UnauthorizedException('Token expired'));

      const authRequest = {
        accessToken: 'expired-token',
      };

      await expect(authService.authenticate(authRequest)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user no longer exists', async () => {
      const tokenPayload = {
        user: mockUser,
      };

      jest
        .spyOn(tokenService, 'verifyAccessToken')
        .mockResolvedValue(tokenPayload);
      jest
        .spyOn(usersService, 'findUser')
        .mockRejectedValue(new Error('User not found'));

      const authRequest = {
        accessToken: 'valid-token',
      };

      await expect(authService.authenticate(authRequest)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should delegate to tokenService.refreshTokens', async () => {
      const result = await authService.refreshToken('valid-refresh-token');

      expect(result).toEqual(mockTokens);
      expect(tokenService.refreshTokens).toHaveBeenCalledWith(
        'valid-refresh-token',
      );
    });
  });

  describe('revokeToken', () => {
    it('should delegate to tokenService.revokeToken', async () => {
      const result = await authService.revokeToken('valid-refresh-token');

      expect(result).toBe(true);
      expect(tokenService.revokeToken).toHaveBeenCalledWith(
        'valid-refresh-token',
      );
    });
  });
});
