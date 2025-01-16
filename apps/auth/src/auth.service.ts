import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
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
} from '@bitsacco/common';
import { UsersService } from './users';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
  ) {
    this.logger.log('AuthService initialized');
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
      const { user, authorized } = await this.userService.verifyUser(req);
      const token = authorized ? this.createAuthToken(user) : undefined;

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
