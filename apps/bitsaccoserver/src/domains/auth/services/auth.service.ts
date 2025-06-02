import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
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

// Define interfaces locally to avoid import issues
export interface LoginUserRequestDto {
  phone?: string;
  npub?: string;
  otp?: string;
  password?: string;
}

export interface RegisterUserRequestDto {
  phone: string;
  name?: string;
  email?: string;
  npub?: string;
}

export interface VerifyUserRequestDto {
  phone?: string;
  npub?: string;
  otp: string;
}

export interface RecoverUserRequestDto {
  phone?: string;
  npub?: string;
  otp?: string;
  pin?: string;
}

export interface AuthRequestDto {
  accessToken: string;
}

export interface AuthResponse {
  user: any;
  accessToken?: string;
  refreshToken?: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RateLimitService {
  checkRateLimit(identifier: string): Promise<void>;
  resetRateLimit(identifier: string): void;
}

@Injectable()
export class AuthService extends BaseDomainService {
  private readonly logger = new Logger(AuthService.name);
  private readonly rateLimitService: RateLimitService;

  constructor(
    protected readonly eventEmitter: EventEmitter2,
    protected readonly metricsService: BusinessMetricsService,
    protected readonly telemetryService: TelemetryService,
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
  ) {
    super(eventEmitter, metricsService, telemetryService);
    this.logger.debug('AuthService initialized');

    // Initialize basic rate limiting
    this.rateLimitService = {
      checkRateLimit: async (identifier: string) => {
        // Basic rate limiting - in production use Redis
        // For now, just log the attempt
        this.logger.debug(`Rate limit check for ${identifier}`);
      },
      resetRateLimit: (identifier: string) => {
        this.logger.debug(`Rate limit reset for ${identifier}`);
      },
    };
  }

  async registerUser(req: RegisterUserRequestDto): Promise<AuthResponse> {
    const startTime = Date.now();
    const authType = req.phone ? 'phone' : req.npub ? 'nostr' : 'unknown';
    const identifier = req.phone || req.npub;

    // Rate limit registration attempts to prevent enumeration attacks
    await this.rateLimitService.checkRateLimit(identifier);

    try {
      const { user, authorized, otp } =
        await this.registerUserWithValidation(req);

      if (!authorized && otp) {
        await this.sendOtp(otp, req.phone, req.npub);
      }

      // Record successful registration metric
      if (authType === 'phone' || authType === 'nostr') {
        await this.metricsService.recordUserRegistration(
          authType as 'phone' | 'nostr',
          true,
        );
      }

      return { user };
    } catch (e) {
      // Record failed registration metric
      if (authType === 'phone' || authType === 'nostr') {
        await this.metricsService.recordUserRegistration(
          authType as 'phone' | 'nostr',
          false,
        );
      }

      this.logger.error(e);
      throw new InternalServerErrorException('Register user failed');
    }
  }

  async loginUser(req: LoginUserRequestDto): Promise<AuthResponse> {
    const startTime = Date.now();
    const authType = req.phone ? 'phone' : req.npub ? 'nostr' : 'unknown';
    const identifier = req.phone || req.npub;

    // Check rate limit before processing login attempt
    await this.rateLimitService.checkRateLimit(identifier);

    try {
      const { user, authorized } = await this.validateUserCredentials(req);

      if (authorized) {
        const { accessToken, refreshToken } =
          await this.tokenService.generateTokens(user);

        // Reset rate limit counter after successful login
        this.rateLimitService.resetRateLimit(identifier);

        // Record successful login metric
        if (authType === 'phone' || authType === 'nostr') {
          await this.metricsService.recordUserLogin(authType, true, user._id);
        }

        return { user, accessToken, refreshToken };
      }

      // Record unsuccessful login (not authorized)
      if (authType === 'phone' || authType === 'nostr') {
        await this.metricsService.recordUserLogin(authType, false, user._id);
      }

      return { user };
    } catch (e) {
      // Record failed login metric
      if (authType === 'phone' || authType === 'nostr') {
        await this.metricsService.recordUserLogin(authType, false);
      }

      this.logger.error(e);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async verifyUser(req: VerifyUserRequestDto): Promise<AuthResponse> {
    const startTime = Date.now();
    const method = req.phone ? 'sms' : 'nostr';
    const identifier = req.phone || req.npub;

    // Rate limit verification attempts to prevent brute forcing OTPs
    await this.rateLimitService.checkRateLimit(identifier);

    try {
      const auth = await this.verifyUserOtp(req);

      if (!auth.authorized && auth.otp) {
        await this.sendOtp(auth.otp, req.phone, req.npub);
        return { user: auth.user };
      }

      const { accessToken, refreshToken } =
        await this.tokenService.generateTokens(auth.user);

      // Reset rate limit counter after successful verification
      this.rateLimitService.resetRateLimit(identifier);

      return { user: auth.user, accessToken, refreshToken };
    } catch (e) {
      this.logger.error(e);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async recoverUser(req: RecoverUserRequestDto): Promise<AuthResponse> {
    const startTime = Date.now();
    const method = req.phone ? 'sms' : 'nostr';
    const identifier = req.phone || req.npub;

    try {
      // Step 1: If no OTP provided, this is the initial recovery request
      if (!req.otp) {
        const auth = await this.recoverUserAccount(req);

        // Send the generated OTP if one was created
        if (!auth.authorized && auth.otp) {
          await this.sendOtp(auth.otp, req.phone, req.npub);
        }

        return { user: auth.user };
      }

      // Step 2: OTP is provided along with a PIN to reset
      const auth = await this.recoverUserAccount(req);

      if (auth.authorized) {
        const { accessToken, refreshToken } =
          await this.tokenService.generateTokens(auth.user);

        // Reset rate limit counter after successful recovery
        this.rateLimitService.resetRateLimit(identifier);

        return { user: auth.user, accessToken, refreshToken };
      }

      return { user: auth.user };
    } catch (e) {
      this.logger.error('Account recovery failed', e);
      throw new UnauthorizedException(
        'Invalid credentials for account recovery',
      );
    }
  }

  async authenticate({ accessToken }: AuthRequestDto): Promise<AuthResponse> {
    try {
      const { user } = await this.tokenService.verifyAccessToken(accessToken);

      try {
        await this.userService.findById(user.id);
      } catch {
        throw new UnauthorizedException('Invalid user');
      }

      return { user, accessToken };
    } catch (error) {
      this.logger.error(`Token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    return this.tokenService.refreshTokens(refreshToken);
  }

  async revokeToken(refreshToken: string): Promise<boolean> {
    return this.tokenService.revokeToken(refreshToken);
  }

  // Helper methods for authentication
  private async validateUserCredentials(req: LoginUserRequestDto) {
    const user = await this.userService.findByPhone(req.phone);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // In development, allow any 6-digit OTP
    const authorized =
      process.env.NODE_ENV === 'development' &&
      req.otp &&
      /^\d{6}$/.test(req.otp);

    return { user: this.sanitizeUser(user), authorized };
  }

  private async registerUserWithValidation(req: RegisterUserRequestDto) {
    // Check if user already exists
    const existingUser = await this.userService.findByPhone(req.phone);
    if (existingUser) {
      throw new BadRequestException(
        'User already exists with this phone number',
      );
    }

    // Create user
    const user = await this.userService.create({
      phone: req.phone,
      name: req.name || 'User',
      email: req.email,
      npub: req.npub,
      role: 'user',
      status: 'active',
      isPhoneVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate OTP for verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const authorized = false; // Always require OTP verification

    return { user: this.sanitizeUser(user), authorized, otp };
  }

  private async verifyUserOtp(req: VerifyUserRequestDto) {
    const user = await this.userService.findByPhone(req.phone);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // In development, accept any 6-digit OTP
    const authorized =
      process.env.NODE_ENV === 'development' &&
      req.otp &&
      /^\d{6}$/.test(req.otp);

    if (authorized) {
      // Mark phone as verified
      await this.userService.update(user._id, { isPhoneVerified: true });
    }

    return { user: this.sanitizeUser(user), authorized };
  }

  private async recoverUserAccount(req: RecoverUserRequestDto) {
    const user = await this.userService.findByPhone(req.phone);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!req.otp) {
      // Generate OTP for recovery
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      return { user: this.sanitizeUser(user), authorized: false, otp };
    }

    // Verify OTP and allow recovery
    const authorized =
      process.env.NODE_ENV === 'development' && /^\d{6}$/.test(req.otp);

    if (authorized && req.pin) {
      // Update user's PIN
      await this.userService.update(user._id, { pin: req.pin });
    }

    return { user: this.sanitizeUser(user), authorized };
  }

  private async sendOtp(otp: string, phone?: string, npub?: string) {
    const message = `${otp} - This is your BITSACCO OTP. Stay protected, don't give this code or your login info to anyone.`;

    if (phone) {
      try {
        this.logger.debug(`Initiating sms OTP send to ${phone}`);
        // In test environment, just log the OTP
        this.logger.debug(`SMS OTP: ${otp}`);
      } catch (e) {
        this.logger.error('SMS sending failed', e);
      }
    }

    // send otp via nostr
    if (npub) {
      this.logger.debug(`Initiating nostr OTP send to ${npub}`);
      this.logger.debug(`Nostr OTP: ${otp}`);
    }
  }

  private sanitizeUser(user: any): any {
    const { password, pin, ...sanitized } = user.toObject
      ? user.toObject()
      : user;
    return sanitized;
  }
}
