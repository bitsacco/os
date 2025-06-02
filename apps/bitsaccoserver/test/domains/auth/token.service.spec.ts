import { beforeAll, afterAll, describe, it, expect, mock } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../../../src/domains/auth/services/token.service';
import { TokenRepository } from '../../../src/domains/auth/repositories/token.repository';
import { BusinessMetricsService } from '../../../src/infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../../src/infrastructure/monitoring/telemetry.service';

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockTokenRepository: any;
  let mockMetricsService: any;
  let mockTelemetryService: any;
  let mockConfigService: any;
  let mockEventEmitter: any;
  let mockJwtService: any;
  let mockUserService: any;

  const testToken = {
    _id: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439012',
    tokenFamily: 'family-123',
    tokenHash: 'hashed-token',
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    revoked: false,
    isRevoked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Helper function to create test user objects
  const createTestUser = (
    userId: string = '507f1f77bcf86cd799439012',
    phone: string = '+254700000001',
  ) => ({
    id: userId,
    _id: userId,
    phone,
    name: 'Test User',
    role: 'user',
    status: 'active',
  });

  beforeAll(async () => {
    // Mock dependencies
    mockTokenRepository = {
      create: mock().mockResolvedValue(testToken),
      findOne: mock().mockResolvedValue(testToken),
      find: mock().mockResolvedValue([testToken]),
      findByTokenId: mock().mockResolvedValue(testToken),
      findByUserId: mock().mockResolvedValue([testToken]),
      findByFamily: mock().mockResolvedValue([testToken]),
      update: mock().mockResolvedValue(testToken),
      updateOne: mock().mockResolvedValue({ matchedCount: 1 }),
      updateMany: mock().mockResolvedValue({ matchedCount: 1 }),
      delete: mock().mockResolvedValue(undefined),
      revokeToken: mock().mockResolvedValue(true),
      revokeFamily: mock().mockResolvedValue(true),
      revokeAllUserTokens: mock().mockResolvedValue(true),
      cleanupExpiredTokens: mock().mockResolvedValue(5),
      getTokenFamily: mock().mockResolvedValue('family-123'),
    };

    mockMetricsService = {
      recordTokenOperation: mock().mockResolvedValue(undefined),
      recordDomainError: mock().mockResolvedValue(undefined),
      recordOperationDuration: mock().mockResolvedValue(undefined),
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

    mockJwtService = {
      sign: mock().mockImplementation((payload: any) => {
        return `header.${btoa(JSON.stringify(payload))}.signature`;
      }),
      verify: mock().mockImplementation((token: string) => {
        if (token.includes('invalid')) {
          throw new Error('Invalid token');
        }
        try {
          const parts = token.split('.');
          if (parts.length !== 3) throw new Error('Malformed token');
          const payload = JSON.parse(atob(parts[1]));

          // Add standard JWT claims if not present
          if (!payload.exp) {
            payload.exp = Math.floor(Date.now() / 1000) + 900; // 15 minutes from now
          }
          if (!payload.iat) {
            payload.iat = Math.floor(Date.now() / 1000);
          }

          return payload;
        } catch {
          throw new Error('Invalid token');
        }
      }),
    };

    mockUserService = {
      findById: mock().mockResolvedValue({
        _id: '507f1f77bcf86cd799439012',
        phone: '+254700000001',
      }),
    };

    mockConfigService = {
      get: mock().mockImplementation((key: string) => {
        const config = {
          JWT_SECRET: 'test-jwt-secret-32-characters-long',
          JWT_EXPIRATION: '900', // 15 minutes
          REFRESH_TOKEN_EXPIRATION_DAYS: '7',
          NODE_ENV: 'test',
        };
        return config[key];
      }),
    };

    // Create TokenService instance
    tokenService = new TokenService(
      mockEventEmitter,
      mockMetricsService,
      mockTelemetryService,
      mockJwtService,
      mockConfigService,
      mockTokenRepository,
      mockUserService,
    );
  });

  afterAll(() => {
    // Clean up
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens successfully', async () => {
      const testUser = {
        id: '507f1f77bcf86cd799439012',
        _id: '507f1f77bcf86cd799439012',
        phone: '+254700000001',
        name: 'Test User',
        role: 'user',
        status: 'active',
      };

      const result = await tokenService.generateTokens(testUser);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(mockTokenRepository.create).toHaveBeenCalled();
      expect(mockMetricsService.recordTokenOperation).toHaveBeenCalledWith(
        testUser.id,
        'issue',
        true,
        expect.any(Number),
      );
    });

    it('should create tokens with proper structure', async () => {
      const testUser = {
        id: '507f1f77bcf86cd799439012',
        _id: '507f1f77bcf86cd799439012',
        phone: '+254700000001',
        name: 'Test User',
        role: 'user',
        status: 'active',
      };

      const result = await tokenService.generateTokens(testUser);

      // Verify JWT structure (header.payload.signature)
      const accessTokenParts = result.accessToken.split('.');
      expect(accessTokenParts).toHaveLength(3);

      const refreshTokenParts = result.refreshToken.split('.');
      expect(refreshTokenParts).toHaveLength(3);
    });

    it('should handle token generation errors', async () => {
      const testUser = {
        id: '507f1f77bcf86cd799439012',
        _id: '507f1f77bcf86cd799439012',
        phone: '+254700000001',
        name: 'Test User',
        role: 'user',
        status: 'active',
      };

      mockTokenRepository.create.mockRejectedValueOnce(
        new Error('Database error'),
      );

      await expect(tokenService.generateTokens(testUser)).rejects.toThrow();
      expect(mockMetricsService.recordTokenOperation).toHaveBeenCalledWith(
        testUser.id,
        'issue',
        false,
        expect.any(Number),
        'Error',
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token successfully', async () => {
      const testUser = {
        id: '507f1f77bcf86cd799439012',
        _id: '507f1f77bcf86cd799439012',
        phone: '+254700000001',
        name: 'Test User',
        role: 'user',
        status: 'active',
      };

      // Generate a token first
      const tokens = await tokenService.generateTokens(testUser);

      const result = await tokenService.verifyAccessToken(tokens.accessToken);

      expect(result.user.id).toBe(testUser.id);
      expect(mockMetricsService.recordTokenOperation).toHaveBeenCalledWith(
        testUser.id,
        'verify',
        true,
        expect.any(Number),
      );
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const invalidToken = 'invalid.token.signature';

      await expect(
        tokenService.verifyAccessToken(invalidToken),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockMetricsService.recordTokenOperation).toHaveBeenCalledWith(
        undefined,
        'verify',
        false,
        expect.any(Number),
        expect.any(String),
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      // Mock an expired token by creating a token with past exp claim
      const expiredPayload = {
        userId: '507f1f77bcf86cd799439012',
        phone: '+254700000001',
        iat: Math.floor(Date.now() / 1000) - 1000,
        exp: Math.floor(Date.now() / 1000) - 1, // 1 second ago (expired)
      };

      const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;

      // Mock JWT verify to throw for expired tokens
      mockJwtService.verify.mockImplementationOnce((token: string) => {
        if (token === expiredToken) {
          const error = new Error('Token expired');
          error.name = 'TokenExpiredError';
          throw error;
        }
        // Normal behavior for other tokens
        return mockJwtService.verify.getMockImplementation()(token);
      });

      await expect(
        tokenService.verifyAccessToken(expiredToken),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const testUser = createTestUser();

      // Generate initial tokens
      const initialTokens = await tokenService.generateTokens(testUser);

      const result = await tokenService.refreshTokens(
        initialTokens.refreshToken,
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.accessToken).not.toBe(initialTokens.accessToken);
      expect(result.refreshToken).not.toBe(initialTokens.refreshToken);
      expect(mockMetricsService.recordTokenOperation).toHaveBeenCalledWith(
        expect.any(String),
        'refresh',
        true,
        expect.any(Number),
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const invalidRefreshToken = 'invalid.refresh.token';

      await expect(
        tokenService.refreshTokens(invalidRefreshToken),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockMetricsService.recordTokenOperation).toHaveBeenCalledWith(
        undefined,
        'refresh',
        false,
        expect.any(Number),
        expect.any(String),
      );
    });

    it('should handle revoked refresh token', async () => {
      const testUser = createTestUser();

      const tokens = await tokenService.generateTokens(testUser);

      // Mock finding a revoked token
      mockTokenRepository.findByTokenId.mockResolvedValueOnce({
        ...testToken,
        revoked: true,
      });

      await expect(
        tokenService.refreshTokens(tokens.refreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should detect token theft and revoke token family', async () => {
      const testUser = createTestUser();

      const tokens = await tokenService.generateTokens(testUser);

      // Simulate token theft by not finding the refresh token in database
      mockTokenRepository.findByTokenId.mockResolvedValueOnce(null);

      await expect(
        tokenService.refreshTokens(tokens.refreshToken),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockTokenRepository.revokeAllUserTokens).toHaveBeenCalled();
    });
  });

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      const testUser = createTestUser();

      // Reset mocks to ensure clean state
      mockTokenRepository.revokeToken.mockClear();
      mockMetricsService.recordTokenOperation.mockClear();

      const tokens = await tokenService.generateTokens(testUser);

      await tokenService.revokeToken(tokens.refreshToken);

      expect(mockTokenRepository.revokeToken).toHaveBeenCalledWith(
        expect.any(String),
      );
      expect(mockMetricsService.recordTokenOperation).toHaveBeenLastCalledWith(
        expect.any(String),
        'revoke',
        true,
        expect.any(Number),
        undefined,
      );
    });

    it('should handle revoking non-existent token', async () => {
      const invalidToken = 'invalid.refresh.token';

      const result = await tokenService.revokeToken(invalidToken);

      expect(result).toBe(false);
      expect(mockMetricsService.recordTokenOperation).toHaveBeenCalledWith(
        undefined,
        'revoke',
        false,
        expect.any(Number),
        expect.any(String),
      );
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens successfully', async () => {
      const testUser = createTestUser();

      await tokenService.revokeAllUserTokens(testUser.id);

      expect(mockTokenRepository.revokeAllUserTokens).toHaveBeenCalledWith(
        testUser.id,
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens successfully', async () => {
      const deletedCount = await tokenService.cleanupExpiredTokens();

      expect(deletedCount).toBe(5);
      expect(mockTokenRepository.cleanupExpiredTokens).toHaveBeenCalled();
    });
  });

  describe('Security Features', () => {
    it('should generate unique tokens for each request', async () => {
      const testUser = createTestUser();

      const tokens1 = await tokenService.generateTokens(testUser);
      const tokens2 = await tokenService.generateTokens(testUser);

      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });

    it('should include security claims in tokens', async () => {
      const testUser = createTestUser();

      const tokens = await tokenService.generateTokens(testUser);
      const payload = await tokenService.verifyAccessToken(tokens.accessToken);

      expect(payload.user.id).toBe(testUser.id);
      expect(payload.iat).toBeDefined(); // Issued at
      expect(payload.exp).toBeDefined(); // Expires at
      expect(payload.exp > payload.iat).toBe(true);
    });

    it('should handle concurrent token operations safely', async () => {
      const testUser = createTestUser();

      const concurrentOps = 5;
      const promises = Array(concurrentOps)
        .fill(null)
        .map(() => tokenService.generateTokens(testUser));

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled').length;

      expect(successful).toBe(concurrentOps);
    });
  });

  describe('Performance', () => {
    it('should generate tokens within acceptable time', async () => {
      const testUser = createTestUser();

      const startTime = Date.now();
      await tokenService.generateTokens(testUser);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should verify tokens within acceptable time', async () => {
      const testUser = createTestUser();

      const tokens = await tokenService.generateTokens(testUser);

      const startTime = Date.now();
      await tokenService.verifyAccessToken(tokens.accessToken);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle multiple token operations efficiently', async () => {
      const testUser = createTestUser();

      const operations = 10;
      const startTime = Date.now();

      for (let i = 0; i < operations; i++) {
        const tokens = await tokenService.generateTokens(testUser);
        await tokenService.verifyAccessToken(tokens.accessToken);
      }

      const totalDuration = Date.now() - startTime;
      const avgDuration = totalDuration / operations;

      expect(avgDuration).toBeLessThan(200); // Average should be under 200ms per operation
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JWT tokens', async () => {
      const malformedTokens = [
        'not.a.jwt',
        'missing.signature',
        'invalid-format',
        '',
        null as any,
        undefined as any,
      ];

      for (const token of malformedTokens) {
        await expect(tokenService.verifyAccessToken(token)).rejects.toThrow(
          UnauthorizedException,
        );
      }
    });

    it('should handle repository errors gracefully', async () => {
      const testUser = createTestUser();

      mockTokenRepository.create.mockRejectedValueOnce(
        new Error('Connection timeout'),
      );

      await expect(tokenService.generateTokens(testUser)).rejects.toThrow();
    });

    it('should handle configuration errors', async () => {
      // Test that TokenService constructor throws with invalid JWT_SECRET
      const badMockConfigService = {
        get: mock().mockImplementation((key: string) => {
          if (key === 'JWT_SECRET') return 'short'; // Too short
          return 'default-value';
        }),
      };

      expect(() => {
        new TokenService(
          mockEventEmitter,
          mockMetricsService,
          mockTelemetryService,
          mockJwtService,
          badMockConfigService,
          mockTokenRepository,
          mockUserService,
        );
      }).toThrow('JWT_SECRET is too weak - must be at least 32 characters');
    });
  });

  describe('Token Lifecycle', () => {
    it('should maintain token family relationships', async () => {
      const testUser = createTestUser();

      // Reset mocks to ensure clean state
      mockTokenRepository.create.mockClear();
      mockTokenRepository.findByTokenId.mockClear();

      // Mock the token repository to return a valid token for refresh
      mockTokenRepository.findByTokenId.mockResolvedValue({
        ...testToken,
        revoked: false,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // Not expired
      });

      const initialTokens = await tokenService.generateTokens(testUser);
      const refreshedTokens = await tokenService.refreshTokens(
        initialTokens.refreshToken,
      );

      // Both tokens should belong to the same family (implementation detail)
      expect(mockTokenRepository.create).toHaveBeenCalledTimes(2);
    });

    it('should properly expire tokens', async () => {
      // This test would normally require time manipulation or shorter expiry times
      // For now, we verify the expiration is set correctly
      const testUser = createTestUser();

      await tokenService.generateTokens(testUser);

      const createCall =
        mockTokenRepository.create.mock.calls[
          mockTokenRepository.create.mock.calls.length - 1
        ];
      const tokenData = createCall[0];

      expect(tokenData.expires).toBeInstanceOf(Date);
      expect(tokenData.expires.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
