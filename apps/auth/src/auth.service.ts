import { firstValueFrom } from 'rxjs';
import {
  Inject,
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
  SmsServiceClient,
  SMS_SERVICE_NAME,
  RecoverUserRequestDto,
  isPreUserAuth,
  TokenResponse,
  AuthRequestDto,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { TokenService } from './tokens/token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly smsService: SmsServiceClient;

  constructor(
    private readonly userService: UsersService,
    private readonly tokenService: TokenService,
    @Inject(SMS_SERVICE_NAME) private readonly smsGrpc: ClientGrpc,
  ) {
    this.logger.debug('AuthService initialized');
    this.smsService =
      this.smsGrpc.getService<SmsServiceClient>(SMS_SERVICE_NAME);
    this.logger.debug('SMS Service Connected');
  }

  async loginUser(req: LoginUserRequestDto): Promise<AuthResponse> {
    try {
      const { user, authorized } = await this.userService.validateUser(req);

      if (authorized) {
        const { accessToken, refreshToken } =
          await this.tokenService.generateTokens(user);
        return { user, accessToken, refreshToken };
      }

      return { user };
    } catch (e) {
      this.logger.error(e);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async registerUser(req: RegisterUserRequestDto): Promise<AuthResponse> {
    try {
      const { user, authorized, otp } =
        await this.userService.registerUser(req);

      if (!authorized) {
        await this.sendOtp(otp, req.phone, req.npub);
      }

      return { user };
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Register user failed');
    }
  }

  async verifyUser(req: VerifyUserRequestDto): Promise<AuthResponse> {
    try {
      const auth = await this.userService.verifyUser(req);

      if (isPreUserAuth(auth)) {
        await this.sendOtp(auth.otp, req.phone, req.npub);
        return { user: auth.user };
      }

      const { accessToken, refreshToken } =
        await this.tokenService.generateTokens(auth.user);
      return { user: auth.user, accessToken, refreshToken };
    } catch (e) {
      this.logger.error(e);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async recoverUser(req: RecoverUserRequestDto): Promise<AuthResponse> {
    try {
      const auth = await this.userService.recoverUser(req);

      const { accessToken, refreshToken } =
        await this.tokenService.generateTokens(auth.user);

      return { user: auth.user, accessToken, refreshToken };
    } catch (e) {
      this.logger.error(e);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async authenticate({ accessToken }: AuthRequestDto): Promise<AuthResponse> {
    try {
      // We should modify TokenService to add a method for verifying access tokens
      // For now we'll delegate this to the tokenService by adjusting our approach

      // First, verify that the user exists
      const tokenData = await this.tokenService.verifyAccessToken(accessToken);
      const { user, expires } = tokenData;

      if (expires < new Date()) {
        throw new UnauthorizedException('Token expired');
      }

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
        const res = await firstValueFrom(
          this.smsService.sendSms({
            message,
            receiver: phone,
          }),
        );
        this.logger.debug(`SMS sent successfully: ${JSON.stringify(res)}`);
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
