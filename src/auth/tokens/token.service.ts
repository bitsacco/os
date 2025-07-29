import { v4 as uuidv4 } from 'uuid';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import {
  TokenRepository,
  RefreshTokenPayload,
  TokenResponse,
  User,
  AuthTokenPayload,
  UsersService,
} from '../../common';
import { TokenMetricsService } from './token.metrics';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly tokenRepository: TokenRepository,
    private readonly usersService: UsersService,
    private readonly metricsService: TokenMetricsService,
  ) {
    // Validate JWT secret strength at runtime
    const jwtSecret = this.configService.get('AUTH_JWT_SECRET');
    if (!jwtSecret || jwtSecret.length < 32) {
      this.logger.error(
        'JWT_SECRET is too weak - must be at least 32 characters',
      );
      throw new Error(
        'JWT_SECRET is too weak - must be at least 32 characters',
      );
    }

    // Schedule a periodic cleanup of expired tokens
    this.scheduleTokenCleanup();
  }

  private scheduleTokenCleanup(): void {
    // Run token cleanup every day (in milliseconds)
    const cleanupInterval = 24 * 60 * 60 * 1000;

    setInterval(async () => {
      try {
        const deletedCount = await this.tokenRepository.cleanupExpiredTokens();
        if (deletedCount > 0) {
          this.logger.log(`Cleaned up ${deletedCount} expired refresh tokens`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to clean up expired tokens: ${error.message}`,
        );
      }
    }, cleanupInterval);

    // Also run cleanup immediately on service start
    this.tokenRepository
      .cleanupExpiredTokens()
      .then((deletedCount) => {
        if (deletedCount > 0) {
          this.logger.log(
            `Initial cleanup: removed ${deletedCount} expired refresh tokens`,
          );
        }
      })
      .catch((error) => {
        this.logger.error(
          `Failed to perform initial token cleanup: ${error.message}`,
        );
      });
  }

  async generateTokens(user: User): Promise<TokenResponse> {
    const startTime = Date.now();

    try {
      const accessToken = this.createAuthToken(user);
      const refreshToken = await this.createRefreshToken(user.id);

      // Record successful token issue metric
      this.metricsService.recordTokenOperationMetric({
        userId: user.id,
        operation: 'issue',
        success: true,
        duration: Date.now() - startTime,
      });

      return {
        accessToken,
        refreshToken,
      };
    } catch (e) {
      // Record failed token issue metric
      this.metricsService.recordTokenOperationMetric({
        userId: user.id,
        operation: 'issue',
        success: false,
        duration: Date.now() - startTime,
        errorType: e.name || 'unknown_error',
      });

      throw e;
    }
  }

  async verifyAccessToken(token: string): Promise<AuthTokenPayload> {
    const startTime = Date.now();
    let userId: string | undefined;

    try {
      const payload = this.jwtService.verify<AuthTokenPayload>(token);
      userId = payload.user.id;

      // Record successful token verification metric
      this.metricsService.recordTokenOperationMetric({
        userId,
        operation: 'verify',
        success: true,
        duration: Date.now() - startTime,
      });

      return payload;
    } catch (error) {
      // Record failed token verification metric
      this.metricsService.recordTokenOperationMetric({
        userId,
        operation: 'verify',
        success: false,
        duration: Date.now() - startTime,
        errorType: error.name || 'unknown_error',
      });

      this.logger.error(`Access token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid access token');
    }
  }

  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    const startTime = Date.now();
    let userId: string | undefined;
    let tokenId: string | undefined;

    // Extract token info for rate limiting
    try {
      const decoded = this.jwtService.decode(refreshToken) as {
        sub?: string;
        jti?: string;
      };
      if (decoded?.sub) {
        userId = decoded.sub;
      }
      if (decoded?.jti) {
        tokenId = decoded.jti;
      }
    } catch (e) {
      // Continue even if we can't decode - the validation step will reject invalid tokens
    }

    try {
      // Verify the refresh token signature
      const payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken);
      userId = payload.userId;
      const tokenId = payload.tokenId;

      // Find the token in database
      const tokenDoc = await this.tokenRepository.findByTokenId(tokenId);

      // Check if token exists and is valid
      if (!tokenDoc) {
        // If token doesn't exist, check if it might be a reused token
        const familyTokens = await this.tokenRepository.findByFamily(tokenId);

        if (familyTokens.length > 0) {
          // This suggests token reuse - revoke the entire family
          this.logger.warn(
            `Possible refresh token theft detected for user ${userId}`,
          );
          await this.tokenRepository.revokeAllUserTokens(userId);

          this.metricsService.recordTokenOperationMetric({
            userId,
            operation: 'refresh',
            success: false,
            duration: Date.now() - startTime,
            errorType: 'token_theft_suspected',
          });

          throw new UnauthorizedException(
            'Security alert: All sessions have been revoked',
          );
        }

        this.metricsService.recordTokenOperationMetric({
          userId,
          operation: 'refresh',
          success: false,
          duration: Date.now() - startTime,
          errorType: 'token_not_found',
        });

        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if token is revoked or expired
      if (tokenDoc.revoked || tokenDoc.expires < new Date()) {
        // Check for token reuse
        const newerFamilyTokens = await this.tokenRepository.find({
          tokenFamily: tokenDoc.tokenFamily,
          createdAt: { $gt: tokenDoc.createdAt },
        });

        if (newerFamilyTokens.length > 0) {
          // This is likely a reused token
          this.logger.warn(`Refresh token reuse detected for user ${userId}`);
          await this.tokenRepository.revokeFamily(tokenDoc.tokenFamily);

          this.metricsService.recordTokenOperationMetric({
            userId,
            operation: 'refresh',
            success: false,
            duration: Date.now() - startTime,
            errorType: 'token_reuse_detected',
          });

          throw new UnauthorizedException(
            'Security alert: Token reuse detected. All related sessions revoked.',
          );
        }

        this.metricsService.recordTokenOperationMetric({
          userId,
          operation: 'refresh',
          success: false,
          duration: Date.now() - startTime,
          errorType: tokenDoc.revoked ? 'token_revoked' : 'token_expired',
        });

        throw new UnauthorizedException('Invalid refresh token');
      }

      // Revoke the current refresh token (one-time use)
      await this.tokenRepository.revokeToken(tokenId);

      // Fetch the current user to ensure they still exist and get the latest user data
      let user;
      try {
        user = await this.usersService.findUser({ id: userId });
      } catch (error) {
        this.metricsService.recordTokenOperationMetric({
          userId,
          operation: 'refresh',
          success: false,
          duration: Date.now() - startTime,
          errorType: 'user_not_found',
        });

        this.logger.error(
          `User not found during token refresh: ${error.message}`,
        );
        throw new NotFoundException('User no longer exists');
      }

      // Create new tokens with the updated user data, passing the previous token ID to maintain the family
      const accessToken = this.createAuthToken(user);
      const newRefreshToken = await this.createRefreshToken(user.id, tokenId);

      // Record successful token refresh metric
      this.metricsService.recordTokenOperationMetric({
        userId,
        operation: 'refresh',
        success: true,
        duration: Date.now() - startTime,
      });

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      // Record failed token refresh metric if not already recorded
      if (
        error.name !== 'UnauthorizedException' &&
        error.name !== 'NotFoundException'
      ) {
        this.metricsService.recordTokenOperationMetric({
          userId,
          operation: 'refresh',
          success: false,
          duration: Date.now() - startTime,
          errorType: error.name || 'unknown_error',
        });
      }

      this.logger.error(`Error refreshing tokens: ${error.message}`);
      throw error instanceof UnauthorizedException ||
        error instanceof NotFoundException
        ? error
        : new UnauthorizedException('Invalid refresh token');
    }
  }

  async revokeToken(refreshToken: string): Promise<boolean> {
    const startTime = Date.now();
    let userId: string | undefined;

    try {
      // First try to verify the token
      const { tokenId, userId: uid } =
        this.jwtService.verify<RefreshTokenPayload>(refreshToken);
      userId = uid;

      // Check if the token exists in the database and is not already revoked
      const tokenDoc = await this.tokenRepository.findByTokenId(tokenId);
      if (!tokenDoc) {
        this.logger.warn(`Token with ID ${tokenId} not found in database`);

        // Record failed token revocation
        this.metricsService.recordTokenOperationMetric({
          userId,
          operation: 'revoke',
          success: false,
          duration: Date.now() - startTime,
          errorType: 'token_not_found',
        });

        return false;
      }

      if (tokenDoc.revoked) {
        this.logger.warn(`Token with ID ${tokenId} was already revoked`);

        // Record successful token revocation (already revoked)
        this.metricsService.recordTokenOperationMetric({
          userId,
          operation: 'revoke',
          success: true,
          duration: Date.now() - startTime,
        });

        return true; // Already revoked, so consider it a success
      }

      // Revoke the token
      const result = await this.tokenRepository.revokeToken(tokenId);

      // Record token revocation result
      this.metricsService.recordTokenOperationMetric({
        userId,
        operation: 'revoke',
        success: result,
        duration: Date.now() - startTime,
        errorType: result ? undefined : 'revocation_failed',
      });

      return result;
    } catch (error) {
      // Record failed token revocation
      this.metricsService.recordTokenOperationMetric({
        userId,
        operation: 'revoke',
        success: false,
        duration: Date.now() - startTime,
        errorType: error.name || 'unknown_error',
      });

      this.logger.error(`Error revoking token: ${error.message}`);
      // We return false instead of throwing an exception to make logout
      // more robust - we don't want to prevent users from logging out
      // even if their token is invalid
      return false;
    }
  }

  async revokeAllUserTokens(userId: string): Promise<boolean> {
    return this.tokenRepository.revokeAllUserTokens(userId);
  }

  private createAuthToken(user: User): string {
    const now = Math.floor(Date.now() / 1000);

    const payload: AuthTokenPayload = {
      user,
      iat: now,
      nbf: now,
      iss: this.configService.get('AUTH_JWT_ISS', 'bitsacco-auth-service'),
      aud: this.configService.get('AUTH_JWT_AUD', 'bitsacco-api'),
      jti: uuidv4(),
    };

    return this.jwtService.sign(payload);
  }

  private async createRefreshToken(
    userId: string,
    prevTokenId?: string,
  ): Promise<string> {
    // Generate a unique token ID
    const tokenId = uuidv4();

    // Get or create a token family ID
    let tokenFamily: string;
    if (prevTokenId) {
      // If we're refreshing, try to get the existing family
      const existingFamily =
        await this.tokenRepository.getTokenFamily(prevTokenId);
      tokenFamily = existingFamily || uuidv4();
    } else {
      // If it's a new token chain, create a new family
      tokenFamily = uuidv4();
    }

    // Calculate expiration (longer than access token)
    const expires = new Date();
    const expirationDays = this.configService.get(
      'REFRESH_TOKEN_EXPIRATION_DAYS',
      7,
    );
    expires.setDate(expires.getDate() + expirationDays);

    // Create payload with standard JWT claims
    const payload: RefreshTokenPayload = {
      userId,
      tokenId,
      iat: Math.floor(Date.now() / 1000),
      jti: tokenId,
      iss: this.configService.get('AUTH_JWT_ISS', 'bitsacco-auth-service'),
      sub: userId,
    };

    // Store token in database
    await this.tokenRepository.create({
      userId,
      tokenId,
      tokenFamily,
      previousTokenId: prevTokenId,
      expires,
      revoked: false,
      __v: 0,
    });

    // Sign and return the JWT with longer expiration time
    const expirationSeconds = expirationDays * 24 * 60 * 60;
    return this.jwtService.sign(payload, { expiresIn: expirationSeconds });
  }
}
