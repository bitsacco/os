import { type Request, type Response } from 'express';
import { firstValueFrom, Observable } from 'rxjs';
import {
  Body,
  Controller,
  Inject,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import {
  AUTH_SERVICE_NAME,
  AuthRequestDto,
  AuthResponse,
  AuthServiceClient,
  AuthTokenPayload,
  LoginUserRequestDto,
  RecoverUserRequestDto,
  RefreshTokenRequestDto,
  RegisterUserRequestDto,
  RevokeTokenRequestDto,
  RevokeTokenResponseDto,
  TokensResponseDto,
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
    return this.setAuthCookies(auth, res);
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
  @ApiOperation({ summary: 'Verify user' })
  @ApiBody({
    type: VerifyUserRequestDto,
  })
  async verify(
    @Body() req: VerifyUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = this.authService.verifyUser(req);
    return this.setAuthCookies(auth, res);
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
    return this.setAuthCookies(auth, res);
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
    return this.setAuthCookies(auth, res);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: TokensResponseDto,
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.RefreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const refreshRequest: RefreshTokenRequestDto = { refreshToken };
    const tokensResponse = this.authService.refreshToken(refreshRequest);

    return firstValueFrom(tokensResponse).then(
      ({ accessToken, refreshToken }) => {
        // Set the new access token cookie
        const accessTokenPayload =
          this.jwtService.decode<AuthTokenPayload>(accessToken);
        res.cookie('Authentication', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires: new Date(accessTokenPayload.expires),
        });

        // Set the new refresh token cookie
        res.cookie('RefreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/auth/refresh', // Only sent to refresh endpoint
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return {
          success: true,
          message: 'Tokens refreshed successfully',
        };
      },
    );
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user and revoke refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    type: RevokeTokenResponseDto,
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.RefreshToken;
    let success = true;

    if (refreshToken) {
      // Attempt to revoke the token
      const revokeRequest: RevokeTokenRequestDto = { refreshToken };
      const response = await firstValueFrom(
        this.authService.revokeToken(revokeRequest),
      );
      success = response.success;
    }

    // Clear cookies regardless of token revocation success
    res.clearCookie('Authentication');
    res.clearCookie('RefreshToken');

    return {
      success,
      message: 'Logged out successfully',
    };
  }

  private async setAuthCookies(auth: Observable<AuthResponse>, res: Response) {
    return firstValueFrom(auth).then(
      ({ user, accessToken, refreshToken }: AuthResponse) => {
        if (accessToken) {
          const { user: jwtUser, expires } =
            this.jwtService.decode<AuthTokenPayload>(accessToken);

          if (user.id !== jwtUser.id) {
            this.logger.error('Invalid auth response');
          }

          // Set access token cookie
          res.cookie('Authentication', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            expires: new Date(expires),
          });

          // Set refresh token cookie if available
          if (refreshToken) {
            res.cookie('RefreshToken', refreshToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/auth/refresh', // Only sent to refresh endpoint
              maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });
          }
        }

        // Don't send the tokens back in the response body for security
        return {
          user,
          authenticated: !!accessToken,
        };
      },
    );
  }
}
