import { beforeAll, afterAll, describe, it, expect, mock } from 'bun:test';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../../src/domains/auth/services/auth.service';
import { UserService } from '../../../src/domains/auth/services/user.service';
import { TokenService } from '../../../src/domains/auth/services/token.service';
import { BusinessMetricsService } from '../../../src/infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../../src/infrastructure/monitoring/telemetry.service';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserService: any;
  let mockTokenService: any;
  let mockMetricsService: any;
  let mockTelemetryService: any;
  let mockEventEmitter: any;
  let mockConfigService: any;

  const testUser = {
    _id: '507f1f77bcf86cd799439011',
    phone: '+254700000001',
    npub: 'npub1test123',
    pin: '$argon2id$v=19$m=65536,t=3,p=4$test',
    isVerified: true,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    // Mock dependencies
    mockUserService = {
      findByPhone: mock().mockResolvedValue(testUser),
      findByNpub: mock().mockResolvedValue(testUser),
      create: mock().mockResolvedValue(testUser),
      update: mock().mockResolvedValue(testUser),
      findById: mock().mockResolvedValue(testUser),
      validatePin: mock().mockResolvedValue(true),
      hashPin: mock().mockResolvedValue('$argon2id$hashed'),
    };

    mockTokenService = {
      generateTokens: mock().mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      }),
      verifyToken: mock().mockResolvedValue({
        userId: testUser._id,
        phone: testUser.phone,
      }),
      refreshTokens: mock().mockResolvedValue({
        accessToken: 'new-jwt-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      }),
      revokeToken: mock().mockResolvedValue(undefined),
      revokeAllUserTokens: mock().mockResolvedValue(undefined),
    };

    mockMetricsService = {
      recordUserRegistration: mock().mockResolvedValue(undefined),
      recordUserLogin: mock().mockResolvedValue(undefined),
      recordVerifyMetric: mock().mockResolvedValue(undefined),
      recordAuthMetric: mock().mockResolvedValue(undefined),
    };

    mockTelemetryService = {
      executeWithSpan: mock().mockImplementation(
        async (name: string, fn: Function) => fn(),
      ),
      recordEvent: mock(),
    };

    mockEventEmitter = {
      emit: mock(),
    };

    mockConfigService = {
      get: mock().mockImplementation((key: string) => {
        const config = {
          JWT_SECRET: 'test-jwt-secret-32-characters-long',
          NODE_ENV: 'test',
          OTP_LENGTH: '6',
          OTP_EXPIRY_MINUTES: '5',
        };
        return config[key];
      }),
    };

    // Create AuthService instance
    authService = new AuthService(
      mockUserService,
      mockTokenService,
      mockEventEmitter,
      mockMetricsService,
      mockTelemetryService,
      mockConfigService,
    );
  });

  afterAll(() => {
    // Clean up
  });

  describe('registerUser', () => {
    it('should register a new user with phone successfully', async () => {
      const registerDto = {
        phone: '+254700000002',
        pin: '123456',
      };

      mockUserService.findByPhone.mockResolvedValueOnce(null); // User doesn't exist
      mockUserService.create.mockResolvedValueOnce({
        ...testUser,
        phone: registerDto.phone,
        isVerified: false,
      });

      const result = await authService.registerUser(registerDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'User registered successfully. Please verify your phone number.',
      );
      expect(result.data.user.phone).toBe(registerDto.phone);
      expect(mockUserService.create).toHaveBeenCalledWith({
        phone: registerDto.phone,
        pin: expect.any(String), // Hashed PIN
        isVerified: false,
      });
      expect(mockMetricsService.recordUserRegistration).toHaveBeenCalledWith(
        'phone',
        true,
      );
    });

    it('should register a new user with npub successfully', async () => {
      const registerDto = {
        npub: 'npub1newuser123',
        pin: '123456',
      };

      mockUserService.findByNpub.mockResolvedValueOnce(null);
      mockUserService.create.mockResolvedValueOnce({
        ...testUser,
        npub: registerDto.npub,
        phone: undefined,
        isVerified: false,
      });

      const result = await authService.registerUser(registerDto);

      expect(result.success).toBe(true);
      expect(result.data.user.npub).toBe(registerDto.npub);
      expect(mockUserService.create).toHaveBeenCalledWith({
        npub: registerDto.npub,
        pin: expect.any(String),
        isVerified: false,
      });
    });

    it('should throw BadRequestException if user already exists', async () => {
      const registerDto = {
        phone: '+254700000001',
        pin: '123456',
      };

      mockUserService.findByPhone.mockResolvedValueOnce(testUser);

      await expect(authService.registerUser(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockMetricsService.recordUserRegistration).toHaveBeenCalledWith(
        'phone',
        false,
      );
    });

    it('should throw BadRequestException if neither phone nor npub provided', async () => {
      const registerDto = {
        pin: '123456',
      };

      await expect(
        authService.registerUser(registerDto as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('loginUser', () => {
    it('should login user with phone and PIN successfully', async () => {
      const loginDto = {
        phone: '+254700000001',
        pin: '123456',
      };

      const result = await authService.loginUser(loginDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Login successful');
      expect(result.data.tokens.accessToken).toBe('jwt-token');
      expect(result.data.user.phone).toBe(testUser.phone);
      expect(mockUserService.validatePin).toHaveBeenCalledWith(
        testUser,
        loginDto.pin,
      );
      expect(mockTokenService.generateTokens).toHaveBeenCalledWith(
        testUser._id,
        testUser.phone,
      );
      expect(mockMetricsService.recordUserLogin).toHaveBeenCalledWith(
        'phone',
        true,
        testUser._id,
      );
    });

    it('should login user with npub and PIN successfully', async () => {
      const loginDto = {
        npub: 'npub1test123',
        pin: '123456',
      };

      const result = await authService.loginUser(loginDto);

      expect(result.success).toBe(true);
      expect(result.data.user.npub).toBe(testUser.npub);
      expect(mockUserService.findByNpub).toHaveBeenCalledWith(loginDto.npub);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const loginDto = {
        phone: '+254700000001',
        pin: 'wrongpin',
      };

      mockUserService.validatePin.mockResolvedValueOnce(false);

      await expect(authService.loginUser(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockMetricsService.recordUserLogin).toHaveBeenCalledWith(
        'phone',
        false,
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const loginDto = {
        phone: '+254700000999',
        pin: '123456',
      };

      mockUserService.findByPhone.mockResolvedValueOnce(null);

      await expect(authService.loginUser(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for unverified user', async () => {
      const loginDto = {
        phone: '+254700000001',
        pin: '123456',
      };

      const unverifiedUser = { ...testUser, isVerified: false };
      mockUserService.findByPhone.mockResolvedValueOnce(unverifiedUser);

      await expect(authService.loginUser(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockMetricsService.recordUserLogin).toHaveBeenCalledWith(
        'phone',
        false,
      );
    });
  });

  describe('verifyUser', () => {
    it('should verify user with valid OTP successfully', async () => {
      const phone = '+254700000001';

      // Generate OTP first
      const otp = authService.generateOtp(phone);

      const verifyDto = {
        phone,
        otp,
      };

      const unverifiedUser = { ...testUser, isVerified: false };
      mockUserService.findByPhone.mockResolvedValueOnce(unverifiedUser);
      mockUserService.update.mockResolvedValueOnce({
        ...unverifiedUser,
        isVerified: true,
      });

      const result = await authService.verifyUser(verifyDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('User verified successfully');
      expect(result.data.user.isVerified).toBe(true);
      expect(mockUserService.update).toHaveBeenCalledWith(unverifiedUser._id, {
        isVerified: true,
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('user.verified', {
        userId: unverifiedUser._id,
        phone: unverifiedUser.phone,
        npub: unverifiedUser.npub,
        timestamp: expect.any(Date),
      });
    });

    it('should verify user with npub successfully', async () => {
      const npub = 'npub1test123';

      // Generate OTP first
      const otp = authService.generateOtp(npub);

      const verifyDto = {
        npub,
        otp,
      };

      const unverifiedUser = { ...testUser, isVerified: false };
      mockUserService.findByNpub.mockResolvedValueOnce(unverifiedUser);
      mockUserService.update.mockResolvedValueOnce({
        ...unverifiedUser,
        isVerified: true,
      });

      const result = await authService.verifyUser(verifyDto);

      expect(result.success).toBe(true);
      expect(result.data.user.npub).toBe(testUser.npub);
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      const verifyDto = {
        phone: '+254700000001',
        otp: 'wrongotp',
      };

      const unverifiedUser = { ...testUser, isVerified: false };
      mockUserService.findByPhone.mockResolvedValueOnce(unverifiedUser);

      await expect(authService.verifyUser(verifyDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockMetricsService.recordVerifyMetric).toHaveBeenCalledWith({
        success: false,
        duration: expect.any(Number),
        method: 'phone',
        errorType: 'Invalid OTP',
      });
    });

    it('should throw BadRequestException for already verified user', async () => {
      const verifyDto = {
        phone: '+254700000001',
        otp: '123456',
      };

      mockUserService.findByPhone.mockResolvedValueOnce(testUser); // Already verified

      await expect(authService.verifyUser(verifyDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for non-existent user', async () => {
      const verifyDto = {
        phone: '+254700000999',
        otp: '123456',
      };

      mockUserService.findByPhone.mockResolvedValueOnce(null);

      await expect(authService.verifyUser(verifyDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('recoverUser', () => {
    it('should recover user account successfully', async () => {
      const phone = '+254700000001';

      // Generate OTP first
      const otp = authService.generateOtp(phone);

      const recoverDto = {
        phone,
        otp,
        newPin: '654321',
      };

      const result = await authService.recoverUser(recoverDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Account recovered successfully');
      expect(mockUserService.update).toHaveBeenCalledWith(testUser._id, {
        pin: expect.any(String), // Hashed new PIN
      });
      expect(mockTokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        testUser._id,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('user.recovery', {
        userId: testUser._id,
        identifier: recoverDto.phone,
        timestamp: expect.any(Date),
      });
    });

    it('should throw BadRequestException for invalid recovery OTP', async () => {
      const recoverDto = {
        phone: '+254700000001',
        otp: 'wrongotp',
        newPin: '654321',
      };

      await expect(authService.recoverUser(recoverDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('authenticate', () => {
    it('should authenticate valid token successfully', async () => {
      const token = 'valid-jwt-token';

      const result = await authService.authenticate({ token });

      expect(result.success).toBe(true);
      expect(result.data.user.phone).toBe(testUser.phone);
      expect(mockTokenService.verifyToken).toHaveBeenCalledWith(token);
      expect(mockUserService.findById).toHaveBeenCalledWith(testUser._id);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const token = 'invalid-token';

      mockTokenService.verifyToken.mockRejectedValueOnce(
        new Error('Invalid token'),
      );

      await expect(authService.authenticate({ token })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const refreshDto = {
        refreshToken: 'valid-refresh-token',
      };

      const result = await authService.refreshToken(refreshDto);

      expect(result.success).toBe(true);
      expect(result.data.tokens.accessToken).toBe('new-jwt-token');
      expect(mockTokenService.refreshTokens).toHaveBeenCalledWith(
        refreshDto.refreshToken,
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const refreshDto = {
        refreshToken: 'invalid-refresh-token',
      };

      mockTokenService.refreshTokens.mockRejectedValueOnce(
        new Error('Invalid refresh token'),
      );

      await expect(authService.refreshToken(refreshDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      const revokeDto = {
        refreshToken: 'token-to-revoke',
      };

      const result = await authService.revokeToken(revokeDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Token revoked successfully');
      expect(mockTokenService.revokeToken).toHaveBeenCalledWith(
        revokeDto.refreshToken,
      );
    });
  });

  describe('generateOtp', () => {
    it('should generate OTP for phone number', () => {
      const phone = '+254700000001';
      const otp = authService.generateOtp(phone);

      expect(typeof otp).toBe('string');
      expect(otp.length).toBe(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('should generate OTP for npub', () => {
      const npub = 'npub1test123';
      const otp = authService.generateOtp(npub);

      expect(typeof otp).toBe('string');
      expect(otp.length).toBe(6);
    });
  });

  describe('validateOtp', () => {
    it('should validate correct OTP', () => {
      const identifier = '+254700000001';
      const otp = authService.generateOtp(identifier);

      const isValid = authService.validateOtp(identifier, otp);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect OTP', () => {
      const identifier = '+254700000001';
      authService.generateOtp(identifier); // Generate and store

      const isValid = authService.validateOtp(identifier, 'wrongotp');
      expect(isValid).toBe(false);
    });

    it('should reject expired OTP', () => {
      const identifier = '+254700000001';
      const otp = authService.generateOtp(identifier);

      // Mock expired OTP by modifying internal storage
      const otpData = (authService as any).otpStorage.get(identifier);
      if (otpData) {
        otpData.expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago
      }

      const isValid = authService.validateOtp(identifier, otp);
      expect(isValid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const loginDto = {
        phone: '+254700000001',
        pin: '123456',
      };

      mockUserService.findByPhone.mockRejectedValueOnce(
        new Error('Database error'),
      );

      await expect(authService.loginUser(loginDto)).rejects.toThrow();
      expect(mockMetricsService.recordUserLogin).toHaveBeenCalledWith(
        'phone',
        false,
      );
    });

    it('should handle token generation errors', async () => {
      const loginDto = {
        phone: '+254700000001',
        pin: '123456',
      };

      mockTokenService.generateTokens.mockRejectedValueOnce(
        new Error('Token error'),
      );

      await expect(authService.loginUser(loginDto)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete authentication operations within acceptable time', async () => {
      const loginDto = {
        phone: '+254700000001',
        pin: '123456',
      };

      const startTime = Date.now();
      await authService.loginUser(loginDto);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent authentication requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map((_, i) =>
          authService.loginUser({
            phone: `+25470000000${i}`,
            pin: '123456',
          }),
        );

      const results = await Promise.allSettled(requests);
      const successful = results.filter((r) => r.status === 'fulfilled').length;

      expect(successful).toBeGreaterThan(0);
    });
  });
});
