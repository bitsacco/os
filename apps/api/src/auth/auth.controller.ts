import { type Response } from 'express';
import { firstValueFrom, Observable } from 'rxjs';
import { Body, Controller, Inject, Logger, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import {
  AUTH_SERVICE_NAME,
  AuthRequestDto,
  AuthResponse,
  AuthServiceClient,
  AuthTokenPayload,
  LoginUserRequestDto,
  RecoverUserRequestDto,
  RegisterUserRequestDto,
  VerifyUserRequestDto,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Controller('auth')
export class AuthController {
  private authService: AuthServiceClient;
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(AUTH_SERVICE_NAME)
    private readonly grpc: ClientGrpc,
    private readonly jwtService: JwtService,
  ) {
    this.authService =
      this.grpc.getService<AuthServiceClient>(AUTH_SERVICE_NAME);
    this.logger.debug('AuthController initialized');
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({
    type: LoginUserRequestDto,
  })
  async login(
    @Body() req: LoginUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = this.authService.loginUser(req);
    return this.setAuthCookie(auth, res);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register user' })
  @ApiBody({
    type: RegisterUserRequestDto,
  })
  register(@Body() req: RegisterUserRequestDto) {
    return this.authService.registerUser(req);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Register user' })
  @ApiBody({
    type: VerifyUserRequestDto,
  })
  async verify(
    @Body() req: VerifyUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = this.authService.verifyUser(req);
    return this.setAuthCookie(auth, res);
  }

  @Post('authenticate')
  @ApiOperation({ summary: 'Authenticate user' })
  @ApiBody({
    type: AuthRequestDto,
  })
  async authenticate(
    @Body() req: AuthRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = this.authService.authenticate(req);
    return this.setAuthCookie(auth, res);
  }

  @Post('recover')
  @ApiOperation({ summary: 'Recover user account' })
  @ApiBody({
    type: RecoverUserRequestDto,
  })
  async recover(
    @Body() req: RecoverUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = this.authService.recoverUser(req);
    return this.setAuthCookie(auth, res);
  }

  private async setAuthCookie(auth: Observable<AuthResponse>, res: Response) {
    return firstValueFrom(auth).then(({ user, token }: AuthResponse) => {
      if (token) {
        const { user: jwtUser, expires } =
          this.jwtService.decode<AuthTokenPayload>(token);

        if (user.id !== jwtUser.id) {
          this.logger.error('Invalid auth response');
        }

        res.cookie('Authentication', token, {
          httpOnly: true,
          expires: new Date(expires),
        });
      }

      return {
        user,
        token,
      };
    });
  }
}
