import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseDomainService } from '../../../shared/domain/base-domain.service';
import { BusinessMetricsService } from '../../../infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../../infrastructure/monitoring/telemetry.service';
import { TokenRepository } from '../repositories/token.repository';
import { DOMAIN_EVENTS } from '../../../shared/domain/domain-events';

@Injectable()
export class TokenService extends BaseDomainService {
  constructor(
    protected readonly eventEmitter: EventEmitter2,
    protected readonly metricsService: BusinessMetricsService,
    protected readonly telemetryService: TelemetryService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenRepository: TokenRepository,
  ) {
    super(eventEmitter, metricsService, telemetryService);
  }

  async generateTokenPair(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.executeWithErrorHandling(
      'generateTokenPair',
      async () => {
        // Generate access token
        const accessToken = this.jwtService.sign(
          { userId, type: 'access' },
          {
            expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION', '15m'),
          },
        );

        // Generate refresh token
        const refreshToken = this.jwtService.sign(
          { userId, type: 'refresh' },
          {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
          },
        );

        // Store refresh token in database
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        await this.tokenRepository.create({
          userId,
          tokenId: refreshToken,
          tokenFamily: `refresh_${userId}_${Date.now()}`,
          previousTokenId: undefined,
          expires: expiresAt,
          revoked: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Publish token generation event
        await this.publishEvent(
          this.createEvent(
            DOMAIN_EVENTS.AUTH.TOKEN_GENERATED,
            userId,
            'User',
            { tokenType: 'refresh' },
            userId,
          ),
        );

        return { accessToken, refreshToken };
      },
      userId,
    );
  }

  async validateRefreshToken(refreshToken: string): Promise<any> {
    return this.executeWithErrorHandling('validateRefreshToken', async () => {
      // Verify JWT signature and expiration
      try {
        const payload = this.jwtService.verify(refreshToken, {
          secret: this.configService.get('JWT_REFRESH_SECRET'),
        });

        if (payload.type !== 'refresh') {
          throw new Error('Invalid token type');
        }

        // Check if token exists in database and is not revoked
        const tokenDoc = await this.tokenRepository.findOne({
          tokenId: refreshToken,
          userId: payload.userId,
        });

        if (!tokenDoc) {
          throw new Error('Token not found or revoked');
        }

        return tokenDoc;
      } catch (error) {
        throw new Error('Invalid refresh token');
      }
    });
  }

  async revokeToken(refreshToken: string): Promise<void> {
    return this.executeWithErrorHandling('revokeToken', async () => {
      const deleted = await this.tokenRepository.findOneAndDelete({
        tokenId: refreshToken,
      });

      if (deleted) {
        await this.publishEvent(
          this.createEvent(
            DOMAIN_EVENTS.AUTH.TOKEN_REVOKED,
            deleted.userId,
            'User',
            { reason: 'manual_revocation' },
            deleted.userId,
          ),
        );
      }
    });
  }

  async findByToken(refreshToken: string): Promise<any> {
    return this.executeWithErrorHandling('findByToken', async () => {
      return this.tokenRepository.findOne({ tokenId: refreshToken });
    });
  }

  async cleanupExpiredTokens(): Promise<number> {
    return this.executeWithErrorHandling('cleanupExpiredTokens', async () => {
      const now = new Date();
      return this.tokenRepository.deleteMany({
        expiresAt: { $lt: now },
      });
    });
  }
}
