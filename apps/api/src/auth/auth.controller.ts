import { type Response } from 'express';
import { firstValueFrom, Observable } from 'rxjs';
import { Body, Controller, Logger, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import {
  AuthRequestDto,
  AuthResponse,
  AuthTokenPayload,
  LoginUserRequestDto,
  RegisterUserRequestDto,
  VerifyUserRequestDto,
} from '@bitsacco/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {
    this.logger.log('AuthController initialized');
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
    return firstValueFrom(this.authService.registerUser(req)).then((user) => ({
      user,
    }));
  }

  @Post('verify')
  @ApiOperation({ summary: 'Register user' })
  @ApiBody({
    type: VerifyUserRequestDto,
  })
  verify(@Body() req: VerifyUserRequestDto) {
    return firstValueFrom(this.authService.verifyUser(req)).then((user) => ({
      user,
    }));
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

  private async setAuthCookie(auth: Observable<AuthResponse>, res: Response) {
    return firstValueFrom(auth).then(({ token }) => {
      const { user, expires } = this.jwtService.decode<AuthTokenPayload>(token);

      res.cookie('Authentication', token, {
        httpOnly: true,
        expires: new Date(expires),
      });

      return {
        user,
        token,
      };
    });
  }
}
