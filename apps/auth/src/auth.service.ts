import { firstValueFrom } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthRequest,
  AuthResponse,
  AuthTokenPayload,
  LoginUserRequestDto,
  RegisterUserRequestDto,
  VerifyUserRequestDto,
  User,
  UsersService,
  SmsServiceClient,
  SMS_SERVICE_NAME,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly smsService: SmsServiceClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
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
      const token = authorized ? this.createAuthToken(user) : undefined;

      return { user, token };
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
      const { user, authorized, otp } = await this.userService.verifyUser(req);

      if (!authorized) {
        await this.sendOtp(otp, req.phone, req.npub);
        return { user };
      }

      const token = this.createAuthToken(user);
      return { user, token };
    } catch (e) {
      this.logger.error(e);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async authenticate({ token }: AuthRequest): Promise<AuthResponse> {
    const { user, expires } = this.jwtService.verify<AuthTokenPayload>(token);

    if (expires < new Date()) {
      throw new UnauthorizedException('Token expired');
    }

    try {
      await this.userService.findUser({
        id: user.id,
      });
    } catch {
      throw new UnauthorizedException('Invalid user');
    }

    return { user, token };
  }

  private createAuthToken(user: User) {
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
