import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
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
  pin: string;
}

export interface RegisterUserRequestDto {
  phone?: string;
  npub?: string;
  pin: string;
  name?: string;
  email?: string;
}

export interface VerifyUserRequestDto {
  phone?: string;
  npub?: string;
  otp: string;
}

export interface RecoverUserRequestDto {
  phone?: string;
  npub?: string;
  otp: string;
  newPin: string;
}

export interface AuthRequestDto {
  token: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: any;
    tokens?: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };
  };
}

export interface TokenResponse {
  success: boolean;
  data: {
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };
  };
}

export interface RateLimitService {
  checkRateLimit(identifier: string): Promise<void>;
  resetRateLimit(identifier: string): void;
}

@Injectable()
export class AuthService extends BaseDomainService {
  private readonly logger = new Logger(AuthService.name);
  private readonly rateLimitService: RateLimitService;
  private readonly otpStorage = new Map<
    string,
    { otp: string; expiresAt: Date }
  >();

  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    protected readonly eventEmitter: EventEmitter2,
    protected readonly metricsService: BusinessMetricsService,
    protected readonly telemetryService: TelemetryService,
    private readonly configService: ConfigService,
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
    const authType = req.phone ? 'phone' : req.npub ? 'nostr' : null;
    const identifier = req.phone || req.npub;

    if (!authType) {
      throw new BadRequestException('Either phone or npub must be provided');
    }

    // Rate limit registration attempts to prevent enumeration attacks
    await this.rateLimitService.checkRateLimit(identifier);

    try {
      // Check if user already exists
      let existingUser = null;
      if (req.phone) {
        existingUser = await this.userService.findByPhone(req.phone);
      } else if (req.npub) {
        existingUser = await this.userService.findByNpub(req.npub);
      }

      if (existingUser) {
        await this.metricsService.recordUserRegistration(authType, false);
        throw new BadRequestException('User already exists');
      }

      // Hash the PIN (use default if not provided)
      const pinToHash = req.pin || '123456'; // Default PIN for new registrations
      const hashedPin = await this.userService.hashPin(pinToHash);

      // Create user
      const userData: any = {
        pin: hashedPin,
        isVerified: false,
      };

      if (req.phone) {
        userData.phone = req.phone;
      } else if (req.npub) {
        userData.npub = req.npub;
      }

      if (req.name) {
        userData.name = req.name;
      }
      if (req.email) {
        userData.email = req.email;
      }

      const user = await this.userService.create(userData);

      // Record successful registration metric
      await this.metricsService.recordUserRegistration(authType, true);

      return {
        success: true,
        message:
          'User registered successfully. Please verify your phone number.',
        data: { user },
      };
    } catch (e) {
      // Record failed registration metric
      await this.metricsService.recordUserRegistration(authType, false);

      if (e instanceof BadRequestException) {
        throw e;
      }

      this.logger.error(e);
      throw new InternalServerErrorException('Register user failed');
    }
  }

  async loginUser(req: LoginUserRequestDto): Promise<AuthResponse> {
    const startTime = Date.now();
    const authType = req.phone ? 'phone' : req.npub ? 'nostr' : null;
    const identifier = req.phone || req.npub;

    if (!authType) {
      throw new BadRequestException('Either phone or npub must be provided');
    }

    // Check rate limit before processing login attempt
    await this.rateLimitService.checkRateLimit(identifier);

    try {
      // Find user
      let user = null;
      if (req.phone) {
        user = await this.userService.findByPhone(req.phone);
      } else if (req.npub) {
        user = await this.userService.findByNpub(req.npub);
      }

      if (!user) {
        await this.metricsService.recordUserLogin(authType, false);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if user is verified
      if (!user.isVerified) {
        await this.metricsService.recordUserLogin(authType, false);
        throw new UnauthorizedException('Account not verified');
      }

      // Validate PIN
      const isPinValid = await this.userService.validatePin(user, req.pin);
      if (!isPinValid) {
        await this.metricsService.recordUserLogin(authType, false);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Generate tokens
      const tokens = await this.tokenService.generateTokens(
        user._id,
        user.phone || user.npub,
      );

      // Reset rate limit counter after successful login
      this.rateLimitService.resetRateLimit(identifier);

      // Record successful login metric
      await this.metricsService.recordUserLogin(authType, true, user._id);

      return {
        success: true,
        message: 'Login successful',
        data: {
          user,
          tokens,
        },
      };
    } catch (e) {
      // Record failed login metric
      await this.metricsService.recordUserLogin(authType, false);

      if (e instanceof UnauthorizedException) {
        throw e;
      }

      this.logger.error(e);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async verifyUser(req: VerifyUserRequestDto): Promise<AuthResponse> {
    const startTime = Date.now();
    const method = req.phone ? 'phone' : 'nostr';
    const identifier = req.phone || req.npub;

    if (!identifier) {
      throw new BadRequestException('Either phone or npub must be provided');
    }

    // Rate limit verification attempts to prevent brute forcing OTPs
    await this.rateLimitService.checkRateLimit(identifier);

    try {
      // Find user
      let user = null;
      if (req.phone) {
        user = await this.userService.findByPhone(req.phone);
      } else if (req.npub) {
        user = await this.userService.findByNpub(req.npub);
      }

      if (!user) {
        await this.metricsService.recordVerifyMetric({
          success: false,
          duration: Date.now() - startTime,
          method,
          errorType: 'User not found',
        });
        throw new BadRequestException('User not found');
      }

      // Check if user is already verified
      if (user.isVerified) {
        await this.metricsService.recordVerifyMetric({
          success: false,
          duration: Date.now() - startTime,
          method,
          errorType: 'Already verified',
        });
        throw new BadRequestException('User is already verified');
      }

      // Validate OTP
      const isOtpValid = this.validateOtp(identifier, req.otp);
      if (!isOtpValid) {
        await this.metricsService.recordVerifyMetric({
          success: false,
          duration: Date.now() - startTime,
          method,
          errorType: 'Invalid OTP',
        });
        throw new BadRequestException('Invalid OTP');
      }

      // Mark user as verified
      const updatedUser = await this.userService.update(user._id, {
        isVerified: true,
      });

      // Emit user verified event
      this.eventEmitter.emit('user.verified', {
        userId: user._id,
        phone: user.phone,
        npub: user.npub,
        timestamp: new Date(),
      });

      // Record successful verification metric
      await this.metricsService.recordVerifyMetric({
        success: true,
        duration: Date.now() - startTime,
        method,
      });

      return {
        success: true,
        message: 'User verified successfully',
        data: { user: updatedUser },
      };
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }

      this.logger.error(e);
      throw new BadRequestException('Verification failed');
    }
  }

  async recoverUser(req: RecoverUserRequestDto): Promise<AuthResponse> {
    const startTime = Date.now();
    const method = req.phone ? 'phone' : 'nostr';
    const identifier = req.phone || req.npub;

    if (!identifier) {
      throw new BadRequestException('Either phone or npub must be provided');
    }

    try {
      // Find user
      let user = null;
      if (req.phone) {
        user = await this.userService.findByPhone(req.phone);
      } else if (req.npub) {
        user = await this.userService.findByNpub(req.npub);
      }

      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Validate OTP
      const isOtpValid = this.validateOtp(identifier, req.otp);
      if (!isOtpValid) {
        throw new BadRequestException('Invalid OTP');
      }

      // Hash new PIN
      const hashedNewPin = await this.userService.hashPin(req.newPin);

      // Update user's PIN
      const updatedUser = await this.userService.update(user._id, {
        pin: hashedNewPin,
      });

      // Revoke all existing tokens for security
      await this.tokenService.revokeAllUserTokens(user._id);

      // Emit recovery event
      this.eventEmitter.emit('user.recovery', {
        userId: user._id,
        identifier,
        timestamp: new Date(),
      });

      return {
        success: true,
        message: 'Account recovered successfully',
        data: { user: updatedUser },
      };
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }

      this.logger.error('Account recovery failed', e);
      throw new BadRequestException('Account recovery failed');
    }
  }

  async authenticate({ token }: AuthRequestDto): Promise<AuthResponse> {
    try {
      const payload = await this.tokenService.verifyToken(token);
      const user = await this.userService.findById(payload.userId);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return {
        success: true,
        message: 'Authentication successful',
        data: { user: this.sanitizeUser(user) },
      };
    } catch (e) {
      this.logger.error('Token verification failed:', e.message);
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(refreshDto: {
    refreshToken: string;
  }): Promise<TokenResponse> {
    try {
      const tokens = await this.tokenService.refreshTokens(
        refreshDto.refreshToken,
      );

      return {
        success: true,
        data: { tokens },
      };
    } catch (e) {
      this.logger.error('Token refresh failed:', e.message);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async revokeToken(revokeDto: {
    refreshToken: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      await this.tokenService.revokeToken(revokeDto.refreshToken);

      return {
        success: true,
        message: 'Token revoked successfully',
      };
    } catch (e) {
      this.logger.error('Token revocation failed:', e.message);
      throw new UnauthorizedException('Token revocation failed');
    }
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

  generateOtp(identifier: string): string {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMinutes = parseInt(
      this.configService.get('OTP_EXPIRY_MINUTES', '5'),
    );
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    this.otpStorage.set(identifier, { otp, expiresAt });
    return otp;
  }

  validateOtp(identifier: string, otp: string): boolean {
    const storedOtpData = this.otpStorage.get(identifier);

    if (!storedOtpData) {
      return false;
    }

    // Check if OTP has expired
    if (storedOtpData.expiresAt < new Date()) {
      this.otpStorage.delete(identifier);
      return false;
    }

    // Check if OTP matches
    if (storedOtpData.otp !== otp) {
      return false;
    }

    // OTP is valid, remove it from storage (single use)
    this.otpStorage.delete(identifier);
    return true;
  }

  private sanitizeUser(user: any): any {
    const { password, pin, ...sanitized } = user.toObject
      ? user.toObject()
      : user;
    return sanitized;
  }
}
