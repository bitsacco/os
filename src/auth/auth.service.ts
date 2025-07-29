import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthResponse,
  LoginUserRequestDto,
  RegisterUserRequestDto,
  VerifyUserRequestDto,
  UsersService,
  RecoverUserRequestDto,
  isPreUserAuth,
  TokenResponse,
  AuthRequestDto,
} from '../common';
import { TokenService } from './tokens/token.service';
import { AuthMetricsService } from './metrics/auth.metrics';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UsersService,
    private readonly tokenService: TokenService,
    private readonly metricsService: AuthMetricsService,
    private readonly rateLimitService: RateLimitService,
    private readonly smsService: SmsService,
  ) {
    this.logger.debug('AuthService initialized');
  }

  async loginUser(req: LoginUserRequestDto): Promise<AuthResponse> {
    const startTime = Date.now();
    const authType = req.phone ? 'phone' : req.npub ? 'npub' : 'unknown';
    const identifier = req.phone || req.npub;

    // Check rate limit before processing login attempt
    await this.rateLimitService.checkRateLimit(identifier);

    try {
      const { user, authorized } = await this.userService.validateUser(req);

      if (authorized) {
        const { accessToken, refreshToken } =
          await this.tokenService.generateTokens(user);

        // Reset rate limit counter after successful login
        this.rateLimitService.resetRateLimit(identifier);

        // Record successful login metric
        this.metricsService.recordLoginMetric({
          userId: user.id,
          success: true,
          duration: Date.now() - startTime,
          authType,
        });

        return { user, accessToken, refreshToken };
      }

      // Record unsuccessful login (not authorized)
      this.metricsService.recordLoginMetric({
        userId: user.id,
        success: false,
        duration: Date.now() - startTime,
        authType,
        errorType: 'not_authorized',
      });

      return { user };
    } catch (e) {
      // Record failed login metric
      this.metricsService.recordLoginMetric({
        userId: undefined,
        success: false,
        duration: Date.now() - startTime,
        authType,
        errorType: e.name || 'unknown_error',
      });

      this.logger.error(e);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async registerUser(req: RegisterUserRequestDto): Promise<AuthResponse> {
    const startTime = Date.now();
    const authType = req.phone ? 'phone' : req.npub ? 'npub' : 'unknown';
    const identifier = req.phone || req.npub;

    // Rate limit registration attempts to prevent enumeration attacks
    await this.rateLimitService.checkRateLimit(identifier);

    try {
      const { user, authorized, otp } =
        await this.userService.registerUser(req);

      if (!authorized) {
        await this.sendOtp(otp, req.phone, req.npub);
      }

      // Record successful registration metric
      this.metricsService.recordRegisterMetric({
        userId: user.id,
        success: true,
        duration: Date.now() - startTime,
        authType,
      });

      return { user };
    } catch (e) {
      // Record failed registration metric
      this.metricsService.recordRegisterMetric({
        userId: undefined,
        success: false,
        duration: Date.now() - startTime,
        authType,
        errorType: e.name || 'unknown_error',
      });

      this.logger.error(e);
      throw new InternalServerErrorException('Register user failed');
    }
  }

  async verifyUser(req: VerifyUserRequestDto): Promise<AuthResponse> {
    const startTime = Date.now();
    const method = req.phone ? 'sms' : 'nostr';
    const identifier = req.phone || req.npub;

    // Rate limit verification attempts to prevent brute forcing OTPs
    await this.rateLimitService.checkRateLimit(identifier);

    try {
      const auth = await this.userService.verifyUser(req);

      if (isPreUserAuth(auth)) {
        await this.sendOtp(auth.otp, req.phone, req.npub);

        // Record verification (partially successful - needs another OTP)
        this.metricsService.recordVerifyMetric({
          userId: auth.user.id,
          success: false,
          duration: Date.now() - startTime,
          method,
          errorType: 'requires_additional_verification',
        });

        return { user: auth.user };
      }

      const { accessToken, refreshToken } =
        await this.tokenService.generateTokens(auth.user);

      // Reset rate limit counter after successful verification
      this.rateLimitService.resetRateLimit(identifier);

      // Record successful verification
      this.metricsService.recordVerifyMetric({
        userId: auth.user.id,
        success: true,
        duration: Date.now() - startTime,
        method,
      });

      return { user: auth.user, accessToken, refreshToken };
    } catch (e) {
      // Record failed verification
      this.metricsService.recordVerifyMetric({
        userId: undefined,
        success: false,
        duration: Date.now() - startTime,
        method,
        errorType: e.name || 'unknown_error',
      });

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
      // We should generate and send an OTP
      if (!req.otp) {
        const auth = await this.userService.recoverUser(req);

        // Send the generated OTP if one was created
        if (isPreUserAuth(auth) && auth.otp) {
          await this.sendOtp(auth.otp, req.phone, req.npub);
        }

        // Record recovery initiation (OTP sent)
        this.metricsService.recordVerifyMetric({
          userId: auth.user.id,
          success: false,
          duration: Date.now() - startTime,
          method,
          errorType: 'recovery_otp_sent',
        });

        // Return just the user info, without tokens
        return { user: auth.user };
      }

      // Step 2: OTP is provided along with a PIN to reset
      // This is the actual PIN reset request
      const auth = await this.userService.recoverUser(req);

      // If the OTP verification was successful and account was recovered
      if (auth.authorized) {
        // Generate tokens for the now-recovered account
        const { accessToken, refreshToken } =
          await this.tokenService.generateTokens(auth.user);

        // Reset rate limit counter after successful recovery
        this.rateLimitService.resetRateLimit(identifier);

        // Record successful account recovery
        this.metricsService.recordVerifyMetric({
          userId: auth.user.id,
          success: true,
          duration: Date.now() - startTime,
          method,
        });

        // Return user with auth tokens
        return { user: auth.user, accessToken, refreshToken };
      }

      // OTP verification failed or account not found
      return { user: auth.user };
    } catch (e) {
      // Record failed recovery attempt
      this.metricsService.recordVerifyMetric({
        userId: undefined,
        success: false,
        duration: Date.now() - startTime,
        method,
        errorType: e.name || 'recovery_failed',
      });

      this.logger.error('Account recovery failed', e);
      throw new UnauthorizedException(
        'Invalid credentials for account recovery',
      );
    }
  }

  async authenticate({ accessToken }: AuthRequestDto): Promise<AuthResponse> {
    try {
      // We should modify TokenService to add a method for verifying access tokens
      // For now we'll delegate this to the tokenService by adjusting our approach

      // Verify the token and get the token data
      const { user } = await this.tokenService.verifyAccessToken(accessToken);

      // The token expiration is now checked by the JWT service automatically
      // and the verifyAccessToken method will throw if the token is expired

      try {
        await this.userService.findUser({ id: user.id });
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

  private async sendOtp(otp: string, phone?: string, npub?: string) {
    // send user otp for verification
    const message = `${otp} - This is your BITSACCO OTP. Stay protected, don't give this code or your login info to anyone.`;

    if (phone) {
      try {
        this.logger.debug(`Initiating sms OTP send to ${phone}`);
        await this.smsService.sendSms({
          message,
          receiver: phone,
        });
        this.logger.debug(`SMS sent successfully`);
      } catch (e) {
        this.logger.error('SMS sending failed', e);
      }
    }

    // send otp via nostr
    if (npub) {
      this.logger.debug(`Initiating nostr OTP send to ${npub}`);
    }
  }
}
