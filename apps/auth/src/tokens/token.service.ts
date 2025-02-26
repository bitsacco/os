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
} from '@bitsacco/common';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly tokenRepository: TokenRepository,
    private readonly usersService: UsersService,
  ) {
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
    const accessToken = this.createAuthToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
    };
  }

  async verifyAccessToken(token: string): Promise<AuthTokenPayload> {
    try {
      return this.jwtService.verify<AuthTokenPayload>(token);
    } catch (error) {
      this.logger.error(`Access token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid access token');
    }
  }

  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    try {
      // Verify the refresh token signature
      const payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken);

      // Find the token in database
      const tokenDoc = await this.tokenRepository.findByTokenId(
        payload.tokenId,
      );

      if (!tokenDoc || tokenDoc.revoked || tokenDoc.expires < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Revoke the current refresh token (one-time use)
      await this.tokenRepository.revokeToken(payload.tokenId);

      // Fetch the current user to ensure they still exist and get the latest user data
      let user;
      try {
        user = await this.usersService.findUser({ id: payload.userId });
      } catch (error) {
        this.logger.error(
          `User not found during token refresh: ${error.message}`,
        );
        throw new NotFoundException('User no longer exists');
      }

      // Create new tokens with the updated user data
      const accessToken = this.createAuthToken(user);
      const newRefreshToken = await this.createRefreshToken(user.id);

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      this.logger.error(`Error refreshing tokens: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async revokeToken(refreshToken: string): Promise<boolean> {
    try {
      // First try to verify the token
      const { tokenId } =
        this.jwtService.verify<RefreshTokenPayload>(refreshToken);

      // Check if the token exists in the database and is not already revoked
      const tokenDoc = await this.tokenRepository.findByTokenId(tokenId);
      if (!tokenDoc) {
        this.logger.warn(`Token with ID ${tokenId} not found in database`);
        return false;
      }

      if (tokenDoc.revoked) {
        this.logger.warn(`Token with ID ${tokenId} was already revoked`);
        return true; // Already revoked, so consider it a success
      }

      // Revoke the token
      return this.tokenRepository.revokeToken(tokenId);
    } catch (error) {
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
    const expires = new Date();
    expires.setSeconds(
      expires.getSeconds() + this.configService.get('JWT_EXPIRATION'),
    );

    const payload: AuthTokenPayload = {
      user,
      expires,
    };

    return this.jwtService.sign(payload);
  }

  private async createRefreshToken(userId: string): Promise<string> {
    // Generate a unique token ID
    const tokenId = uuidv4();

    // Calculate expiration (longer than access token)
    const expires = new Date();
    expires.setDate(
      expires.getDate() +
        this.configService.get('REFRESH_TOKEN_EXPIRATION_DAYS', 7),
    );

    // Create payload
    const payload: RefreshTokenPayload = {
      userId,
      tokenId,
      expires,
    };

    // Store token in database
    await this.tokenRepository.create({
      userId,
      tokenId,
      expires,
      revoked: false,
    });

    // Sign and return the JWT
    return this.jwtService.sign(payload);
  }
}
