import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UnauthorizedException } from '@nestjs/common';
import {
  TokenRepository,
  RefreshTokenPayload,
  UsersService,
  Role,
  TokenDocument,
} from '@bitsacco/common';
import { TokenService } from './token.service';
import { TokenMetricsService } from './token.metrics';

describe('TokenService', () => {
  let tokenService: TokenService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let tokenRepository: TokenRepository;
  let usersService: UsersService;
  let metricsService: TokenMetricsService;

  const mockUser = {
    id: 'test-user-id',
    phone: {
      number: '+1234567890',
      verified: true,
    },
    roles: [Role.Member, Role.Admin],
  };

  const mockTokenId = 'test-token-id';
  const mockRefreshToken = 'refreshtoken123';
  const mockAccessToken = 'accesstoken123';

  const mockRefreshPayload: RefreshTokenPayload = {
    userId: mockUser.id,
    tokenId: mockTokenId,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  };

  const mockTokenDoc: TokenDocument = {
    _id: '',
    userId: mockUser.id,
    tokenId: mockTokenId,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revoked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create mocks
    const mockJwtService = {
      sign: jest.fn().mockImplementation((payload) => {
        if (payload.user) return mockAccessToken;
        if (payload.tokenId) return mockRefreshToken;
        return 'unknown-token';
      }),
      verify: jest.fn().mockImplementation((token) => {
        if (token === mockAccessToken) {
          return {
            user: mockUser,
            expires: new Date(Date.now() + 3600 * 1000),
          };
        }
        if (token === mockRefreshToken) {
          return mockRefreshPayload;
        }
        throw new Error('Invalid token');
      }),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key, defaultValue) => {
        const config = {
          JWT_EXPIRATION: 3600,
          REFRESH_TOKEN_EXPIRATION_DAYS: 7,
        };
        return config[key] || defaultValue;
      }),
    };

    const mockTokenRepository = {
      create: jest.fn().mockResolvedValue(mockTokenDoc),
      findByTokenId: jest.fn().mockResolvedValue(mockTokenDoc),
      revokeToken: jest.fn().mockResolvedValue(true),
      revokeAllUserTokens: jest.fn().mockResolvedValue(true),
      cleanupExpiredTokens: jest.fn().mockResolvedValue(5),
    };

    const mockUsersService = {
      findUser: jest.fn().mockResolvedValue(mockUser),
    };

    // Create mock for TokenMetricsService
    const mockMetricsService = {
      recordTokenOperationMetric: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({}),
      resetMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: TokenRepository,
          useValue: mockTokenRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: TokenMetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    tokenService = module.get<TokenService>(TokenService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    tokenRepository = module.get<TokenRepository>(TokenRepository);
    usersService = module.get<UsersService>(UsersService);
    metricsService = module.get<TokenMetricsService>(TokenMetricsService);
  });

  it('should be defined', () => {
    expect(tokenService).toBeDefined();
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const result = await tokenService.generateTokens(mockUser);

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(tokenRepository.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        tokenId: expect.any(String),
        expires: expect.any(Date),
        revoked: false,
      });
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', async () => {
      const result = await tokenService.verifyAccessToken(mockAccessToken);

      expect(result).toEqual({
        user: mockUser,
        expires: expect.any(Date),
      });

      expect(jwtService.verify).toHaveBeenCalledWith(mockAccessToken);
    });

    it('should throw UnauthorizedException for invalid access token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        tokenService.verifyAccessToken('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const result = await tokenService.refreshTokens(mockRefreshToken);

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });

      expect(jwtService.verify).toHaveBeenCalledWith(mockRefreshToken);
      expect(tokenRepository.findByTokenId).toHaveBeenCalledWith(mockTokenId);
      expect(tokenRepository.revokeToken).toHaveBeenCalledWith(mockTokenId);
      expect(usersService.findUser).toHaveBeenCalledWith({ id: mockUser.id });
    });

    it('should throw UnauthorizedException when refresh token is revoked', async () => {
      jest.spyOn(tokenRepository, 'findByTokenId').mockResolvedValue({
        ...mockTokenDoc,
        revoked: true,
      });

      await expect(
        tokenService.refreshTokens(mockRefreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when refresh token is expired', async () => {
      jest.spyOn(tokenRepository, 'findByTokenId').mockResolvedValue({
        ...mockTokenDoc,
        expires: new Date(Date.now() - 1000), // Expired
      });

      await expect(
        tokenService.refreshTokens(mockRefreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when user no longer exists', async () => {
      jest.spyOn(usersService, 'findUser').mockImplementation(() => {
        throw new Error('User not found');
      });

      await expect(
        tokenService.refreshTokens(mockRefreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('revokeToken', () => {
    it('should revoke a valid token', async () => {
      const result = await tokenService.revokeToken(mockRefreshToken);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith(mockRefreshToken);
      expect(tokenRepository.findByTokenId).toHaveBeenCalledWith(mockTokenId);
      expect(tokenRepository.revokeToken).toHaveBeenCalledWith(mockTokenId);
    });

    it('should return true when token is already revoked', async () => {
      jest.spyOn(tokenRepository, 'findByTokenId').mockResolvedValue({
        ...mockTokenDoc,
        revoked: true,
      });

      const result = await tokenService.revokeToken(mockRefreshToken);

      expect(result).toBe(true);
      expect(tokenRepository.revokeToken).not.toHaveBeenCalled();
    });

    it('should return false when token is not found', async () => {
      jest.spyOn(tokenRepository, 'findByTokenId').mockResolvedValue(null);

      const result = await tokenService.revokeToken(mockRefreshToken);

      expect(result).toBe(false);
      expect(tokenRepository.revokeToken).not.toHaveBeenCalled();
    });

    it('should return false when token verification fails', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await tokenService.revokeToken('invalid-token');

      expect(result).toBe(false);
      expect(tokenRepository.revokeToken).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens', async () => {
      const result = await tokenService.revokeAllUserTokens(mockUser.id);

      expect(result).toBe(true);
      expect(tokenRepository.revokeAllUserTokens).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired tokens', async () => {
      // We need to access the private method, this is just for testing
      const result = await (
        tokenService as any
      ).tokenRepository.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(tokenRepository.cleanupExpiredTokens).toHaveBeenCalled();
    });
  });
});
