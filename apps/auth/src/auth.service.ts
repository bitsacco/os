import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import {
  AuthRequest,
  LoginUserRequestDto,
  RegisterUserRequestDto,
  User,
  VerifyUserRequestDto,
} from '@bitsacco/common';
import { UsersService } from './users';

interface AuthTokenPayload {
  user: User;
  expires: Date;
}

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

  async loginUser(req: LoginUserRequestDto) {
    const user = await this.userService.validateUser(req);

    return this.createAuthToken(user);
  }

  async registerUser(req: RegisterUserRequestDto) {
    return this.userService.registerUser(req);
  }

  async verifyUser(req: VerifyUserRequestDto) {
    return this.userService.verifyUser(req);
  }

  async authenticate({ token }: AuthRequest) {
    const { user, expires } = this.jwtService.verify<AuthTokenPayload>(token);

    if (expires < new Date()) {
      throw new Error('Token expired. Unauthenticated');
    }

    const u = await this.userService.findUser({
      id: user.id,
    });

    return this.createAuthToken(u);
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
