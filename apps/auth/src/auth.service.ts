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
    this.logger.log('AuthService initialized');
    this.smsService =
      this.smsGrpc.getService<SmsServiceClient>(SMS_SERVICE_NAME);
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
      const user = await this.userService.registerUser(req);

      return { user };
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Register user failed');
    }
  }

  async verifyUser(req: VerifyUserRequestDto): Promise<AuthResponse> {
    try {
      const { user, authorized, otp } = await this.userService.verifyUser(req);

      let token: string | undefined = undefined;
      if (authorized) {
        token = this.createAuthToken(user);
      } else {
      }

      if (!authorized) {
        const { phone, npub } = req;

        // send user otp for verification
        if (phone) {
          try {
            this.smsService.sendSms({
              message: otp,
              receiver: phone,
            });
          } catch (e) {
            this.logger.error(e);
          }
        }

        if (npub) {
          // send otp via nostr
        }
      }

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
}
