import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as request from 'supertest';
import { AuthDomainModule } from '../../../src/domains/auth/auth-domain.module';
import { AuthService } from '../../../src/domains/auth/services/auth.service';
import { TokenService } from '../../../src/domains/auth/services/token.service';
import { ApiKeyService } from '../../../src/domains/auth/services/apikey.service';
import { UserService } from '../../../src/domains/auth/services/user.service';
import { BusinessMetricsService } from '../../../src/infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../../src/infrastructure/monitoring/telemetry.service';
import { createTestingModuleWithValidation } from '@bitsacco/testing';

describe.skip('Auth Domain Migration E2E Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let tokenService: TokenService;
  let apiKeyService: ApiKeyService;
  let userService: UserService;
  let metricsService: BusinessMetricsService;

  const testUser = {
    phone: '+254700000001',
    name: 'Test User',
    email: 'test@example.com',
    npub: 'npub1test123',
  };

  const testCredentials = {
    phone: '+254700000001',
    otp: '123456',
  };

  beforeAll(async () => {
    // Mock metrics and telemetry services
    const mockBusinessMetricsService = {
      recordUserRegistration: () => Promise.resolve(),
      recordUserLogin: () => Promise.resolve(),
      recordTokenOperation: () => Promise.resolve(),
      recordDomainError: () => Promise.resolve(),
      recordOperationDuration: () => Promise.resolve(),
      recordCommunicationMetric: () => Promise.resolve(),
      recordApiCall: () => Promise.resolve(),
      recordAuthEvent: () => Promise.resolve(),
      recordVerifyMetric: () => Promise.resolve(),
    };

    const mockTelemetryService = {
      executeWithSpan: async (name: string, fn: Function) => fn(),
      recordEvent: () => {},
    };

    const moduleFixture: TestingModule =
      await createTestingModuleWithValidation({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env.test',
          }),
          MongooseModule.forRoot(
            process.env.TEST_DATABASE_URL || 'mongodb://localhost/test',
          ),
          EventEmitterModule.forRoot(),
          AuthDomainModule,
        ],
        providers: [
          {
            provide: BusinessMetricsService,
            useValue: mockBusinessMetricsService,
          },
          {
            provide: TelemetryService,
            useValue: mockTelemetryService,
          },
        ],
      });

    app = moduleFixture.createNestApplication();

    authService = moduleFixture.get<AuthService>(AuthService);
    tokenService = moduleFixture.get<TokenService>(TokenService);
    apiKeyService = moduleFixture.get<ApiKeyService>(ApiKeyService);
    userService = moduleFixture.get<UserService>(UserService);
    metricsService = moduleFixture.get<BusinessMetricsService>(
      BusinessMetricsService,
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Performance Benchmarks', () => {
    it('should meet response time requirements for registration', async () => {
      const startTime = Date.now();

      const result = await authService.registerUser(testUser);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // < 2s requirement
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('user');
    });

    it('should meet response time requirements for login', async () => {
      // First register a user
      await authService.registerUser({
        ...testUser,
        phone: '+254700000002',
      });

      const startTime = Date.now();

      const result = await authService.loginUser({
        phone: '+254700000002',
        otp: '123456',
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // < 2s requirement
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should meet response time requirements for token refresh', async () => {
      // Create user and get tokens
      const authResult = await authService.registerUser({
        ...testUser,
        phone: '+254700000003',
      });

      const startTime = Date.now();

      const result = await authService.refreshToken(authResult.refreshToken);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // < 2s requirement
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('Functional Compatibility Tests', () => {
    describe('User Registration', () => {
      it('should register user with phone number', async () => {
        const result = await authService.registerUser({
          ...testUser,
          phone: '+254700000004',
        });

        expect(result.user).toMatchObject({
          phone: '+254700000004',
          name: testUser.name,
          email: testUser.email,
          role: 'user',
          status: 'active',
        });
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
      });

      it('should register user with nostr npub', async () => {
        const result = await authService.registerUser({
          ...testUser,
          phone: '+254700000005',
          npub: 'npub1test456',
        });

        expect(result.user.npub).toBe('npub1test456');
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
      });

      it('should prevent duplicate phone number registration', async () => {
        await authService.registerUser({
          ...testUser,
          phone: '+254700000006',
        });

        await expect(
          authService.registerUser({
            ...testUser,
            phone: '+254700000006',
          }),
        ).rejects.toThrow('User already exists with this phone number');
      });
    });

    describe('User Authentication', () => {
      beforeEach(async () => {
        await authService.registerUser({
          ...testUser,
          phone: '+254700000007',
        });
      });

      it('should authenticate user with valid OTP', async () => {
        const result = await authService.loginUser({
          phone: '+254700000007',
          otp: '123456',
        });

        expect(result.user.phone).toBe('+254700000007');
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
      });

      it('should reject authentication with invalid OTP', async () => {
        await expect(
          authService.loginUser({
            phone: '+254700000007',
            otp: 'invalid',
          }),
        ).rejects.toThrow('Invalid OTP');
      });

      it('should reject authentication for non-existent user', async () => {
        await expect(
          authService.loginUser({
            phone: '+254700000999',
            otp: '123456',
          }),
        ).rejects.toThrow('Invalid credentials');
      });
    });

    describe('Token Management', () => {
      let userTokens: { accessToken: string; refreshToken: string };

      beforeEach(async () => {
        const authResult = await authService.registerUser({
          ...testUser,
          phone: '+254700000008',
        });
        userTokens = {
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,
        };
      });

      it('should generate valid token pair', async () => {
        const user = await userService.findByPhone('+254700000008');
        const tokens = await tokenService.generateTokenPair(user._id);

        expect(tokens.accessToken).toBeDefined();
        expect(tokens.refreshToken).toBeDefined();
        expect(typeof tokens.accessToken).toBe('string');
        expect(typeof tokens.refreshToken).toBe('string');
      });

      it('should refresh tokens successfully', async () => {
        const newTokens = await authService.refreshToken(
          userTokens.refreshToken,
        );

        expect(newTokens.accessToken).toBeDefined();
        expect(newTokens.refreshToken).toBeDefined();
        expect(newTokens.accessToken).not.toBe(userTokens.accessToken);
        expect(newTokens.refreshToken).not.toBe(userTokens.refreshToken);
      });

      it('should validate refresh token', async () => {
        const tokenDoc = await tokenService.validateRefreshToken(
          userTokens.refreshToken,
        );

        expect(tokenDoc).toBeDefined();
        expect(tokenDoc.userId).toBeDefined();
        expect(tokenDoc.revoked).toBe(false);
      });

      it('should revoke refresh token', async () => {
        await authService.logout(userTokens.refreshToken);

        await expect(
          tokenService.validateRefreshToken(userTokens.refreshToken),
        ).rejects.toThrow('Invalid refresh token');
      });

      it('should reject invalid refresh token', async () => {
        await expect(authService.refreshToken('invalid-token')).rejects.toThrow(
          'Invalid refresh token',
        );
      });
    });

    describe('API Key Management', () => {
      it('should create API key for service', async () => {
        const hashedKey = 'test-hashed-key-123';
        const apiKey = await apiKeyService.createApiKey(
          'test-service',
          hashedKey,
        );

        expect(apiKey).toMatchObject({
          name: 'test-service',
          ownerId: 'system',
          revoked: false,
          isPermanent: true,
        });
        expect(apiKey.keyHash).toBe(hashedKey);
      });

      it('should validate API key', async () => {
        const hashedKey = 'test-hashed-key-456';
        const apiKey = await apiKeyService.createApiKey(
          'test-service-2',
          hashedKey,
        );
        const keyId = apiKey._id.toString();

        const isValid = await apiKeyService.validateApiKey(keyId, hashedKey);
        expect(isValid).toBe(true);
      });

      it('should reject invalid API key', async () => {
        const isValid = await apiKeyService.validateApiKey(
          'invalid-key-id',
          'invalid-hash',
        );
        expect(isValid).toBe(false);
      });

      it('should revoke API key', async () => {
        const hashedKey = 'test-hashed-key-789';
        const apiKey = await apiKeyService.createApiKey(
          'test-service-3',
          hashedKey,
        );
        const keyId = apiKey._id.toString();

        await apiKeyService.revokeApiKey(keyId);

        const isValid = await apiKeyService.validateApiKey(keyId, hashedKey);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Data Integrity Tests', () => {
    it('should maintain user data consistency during registration', async () => {
      const userData = {
        phone: '+254700000009',
        name: 'Integrity Test User',
        email: 'integrity@example.com',
        npub: 'npub1integrity',
      };

      const authResult = await authService.registerUser(userData);
      const storedUser = await userService.findByPhone(userData.phone);

      expect(storedUser.phone).toBe(userData.phone);
      expect(storedUser.name).toBe(userData.name);
      expect(storedUser.email).toBe(userData.email);
      expect(storedUser.npub).toBe(userData.npub);
      expect(storedUser.role).toBe('user');
      expect(storedUser.status).toBe('active');
      expect(storedUser._id.toString()).toBe(authResult.user._id);
    });

    it('should maintain token relationships', async () => {
      const user = await authService.registerUser({
        ...testUser,
        phone: '+254700000010',
      });

      const refreshTokenDoc = await tokenService.findByToken(user.refreshToken);

      expect(refreshTokenDoc).toBeDefined();
      expect(refreshTokenDoc.userId).toBe(user.user._id);
      expect(refreshTokenDoc.revoked).toBe(false);
      expect(refreshTokenDoc.expires).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling & Security Tests', () => {
    it('should handle concurrent login attempts gracefully', async () => {
      await authService.registerUser({
        ...testUser,
        phone: '+254700000011',
      });

      const loginPromises = Array(5)
        .fill(null)
        .map(() =>
          authService.loginUser({
            phone: '+254700000011',
            otp: '123456',
          }),
        );

      const results = await Promise.allSettled(loginPromises);

      // All should succeed as we're using valid credentials
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });

    it('should handle malformed token gracefully', async () => {
      await expect(
        authService.refreshToken('malformed.token.here'),
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should sanitize user data in responses', async () => {
      const result = await authService.registerUser({
        ...testUser,
        phone: '+254700000012',
      });

      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should record user registration metrics', async () => {
      const metricsSpy = jest.spyOn(metricsService, 'recordUserRegistration');

      await authService.registerUser({
        ...testUser,
        phone: '+254700000013',
      });

      expect(metricsSpy).toHaveBeenCalledWith('phone', true);
    });

    it('should record user login metrics', async () => {
      await authService.registerUser({
        ...testUser,
        phone: '+254700000014',
      });

      const metricsSpy = jest.spyOn(metricsService, 'recordUserLogin');

      await authService.loginUser({
        phone: '+254700000014',
        otp: '123456',
      });

      expect(metricsSpy).toHaveBeenCalledWith(
        'phone',
        true,
        expect.any(String),
      );
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should cleanup expired tokens', async () => {
      // Create tokens that expire immediately
      const user = await userService.create({
        phone: '+254700000015',
        name: 'Cleanup Test',
        role: 'user',
        status: 'active',
        isPhoneVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Manually create expired token
      await tokenService.tokenRepository.create({
        userId: user._id,
        tokenId: 'expired-token-123',
        tokenFamily: 'cleanup-test',
        expires: new Date(Date.now() - 86400000), // 1 day ago
        revoked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const deletedCount = await tokenService.cleanupExpiredTokens();
      expect(deletedCount).toBeGreaterThan(0);
    });
  });
});
