import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseDomainService } from '../../../shared/domain/base-domain.service';
import { BusinessMetricsService } from '../../../infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../../infrastructure/monitoring/telemetry.service';
import { UserService } from './user.service';
import { TokenService } from './token.service';
import {
  DOMAIN_EVENTS,
  UserRegisteredEvent,
} from '../../../shared/domain/domain-events';
import * as argon2 from 'argon2';

export interface LoginDto {
  phone: string;
  otp?: string;
  password?: string;
}

export interface RegisterDto {
  phone: string;
  name: string;
  email?: string;
  npub?: string;
}

export interface AuthResult {
  user: any;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService extends BaseDomainService {
  constructor(
    protected readonly eventEmitter: EventEmitter2,
    protected readonly metricsService: BusinessMetricsService,
    protected readonly telemetryService: TelemetryService,
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
  ) {
    super(eventEmitter, metricsService, telemetryService);
  }

  async register(registerDto: RegisterDto): Promise<AuthResult> {
    return this.executeWithErrorHandling('register', async () => {
      // Check if user already exists
      const existingUser = await this.userService.findByPhone(
        registerDto.phone,
      );
      if (existingUser) {
        throw new BadRequestException(
          'User already exists with this phone number',
        );
      }

      // Create user
      const user = await this.userService.create({
        phone: registerDto.phone,
        name: registerDto.name,
        email: registerDto.email,
        npub: registerDto.npub,
        role: 'user',
        status: 'active',
        isPhoneVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Generate tokens
      const { accessToken, refreshToken } =
        await this.tokenService.generateTokenPair(user._id);

      // Publish domain event
      const event = this.createEvent(
        DOMAIN_EVENTS.USER.REGISTERED,
        user._id,
        'User',
        {
          userId: user._id,
          phone: user.phone,
          registrationMethod: registerDto.npub ? 'nostr' : 'phone',
          timestamp: new Date(),
        } as UserRegisteredEvent,
        user._id,
      );

      await this.publishEvent(event);

      // Record metrics
      await this.metricsService.recordUserRegistration(
        registerDto.npub ? 'nostr' : 'phone',
        true,
      );

      return {
        user: this.sanitizeUser(user),
        accessToken,
        refreshToken,
      };
    });
  }

  async login(loginDto: LoginDto): Promise<AuthResult> {
    return this.executeWithErrorHandling('login', async () => {
      const user = await this.userService.findByPhone(loginDto.phone);
      if (!user) {
        await this.metricsService.recordUserLogin('phone', false);
        throw new UnauthorizedException('Invalid credentials');
      }

      // For now, we'll implement phone-based login
      // In production, you'd verify OTP here
      if (loginDto.otp) {
        // TODO: Verify OTP via SMS service
        const isOtpValid = await this.verifyOtp(loginDto.phone, loginDto.otp);
        if (!isOtpValid) {
          await this.metricsService.recordUserLogin('phone', false, user._id);
          throw new UnauthorizedException('Invalid OTP');
        }
      }

      // Generate tokens
      const { accessToken, refreshToken } =
        await this.tokenService.generateTokenPair(user._id);

      // Publish login event
      const event = this.createEvent(
        DOMAIN_EVENTS.USER.LOGIN_SUCCESSFUL,
        user._id,
        'User',
        {
          userId: user._id,
          loginMethod: 'phone',
          timestamp: new Date(),
        },
        user._id,
      );

      await this.publishEvent(event);

      // Record metrics
      await this.metricsService.recordUserLogin('phone', true, user._id);

      return {
        user: this.sanitizeUser(user),
        accessToken,
        refreshToken,
      };
    });
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.executeWithErrorHandling('refreshToken', async () => {
      const tokenDoc =
        await this.tokenService.validateRefreshToken(refreshToken);
      if (!tokenDoc) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.userService.findById(tokenDoc.userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new token pair
      const tokens = await this.tokenService.generateTokenPair(user._id);

      // Revoke old refresh token
      await this.tokenService.revokeToken(refreshToken);

      // Publish token refresh event
      const event = this.createEvent(
        DOMAIN_EVENTS.AUTH.TOKEN_REFRESHED,
        user._id,
        'User',
        {
          userId: user._id,
          timestamp: new Date(),
        },
        user._id,
      );

      await this.publishEvent(event);

      return tokens;
    });
  }

  async logout(refreshToken: string): Promise<void> {
    return this.executeWithErrorHandling('logout', async () => {
      await this.tokenService.revokeToken(refreshToken);

      // Publish logout event
      const tokenDoc = await this.tokenService.findByToken(refreshToken);
      if (tokenDoc) {
        const event = this.createEvent(
          DOMAIN_EVENTS.AUTH.TOKEN_REVOKED,
          tokenDoc.userId,
          'User',
          {
            userId: tokenDoc.userId,
            reason: 'logout',
            timestamp: new Date(),
          },
          tokenDoc.userId,
        );

        await this.publishEvent(event);
      }
    });
  }

  async validateUser(userId: string): Promise<any> {
    return this.executeWithErrorHandling('validateUser', async () => {
      const user = await this.userService.findById(userId);
      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('User not found or inactive');
      }

      return this.sanitizeUser(user);
    });
  }

  private async verifyOtp(phone: string, otp: string): Promise<boolean> {
    // TODO: Implement OTP verification with SMS service
    // For now, accept any 6-digit OTP in development
    if (process.env.NODE_ENV === 'development' && /^\d{6}$/.test(otp)) {
      return true;
    }

    // In production, this would verify against stored OTP
    return false;
  }

  private sanitizeUser(user: any): any {
    const { password, ...sanitized } = user.toObject ? user.toObject() : user;
    return sanitized;
  }
}
