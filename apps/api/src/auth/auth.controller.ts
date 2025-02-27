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
  AuthResponse,
  AuthServiceClient,
  AuthTokenPayload,
  getAccessToken,
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
    @Req() req: Request,
    @Body() body: LoginUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = this.authService.loginUser(body);
    return this.setAuthCookies(auth, req, res);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register user' })
  @ApiBody({
    type: RegisterUserRequestDto,
  })
  register(@Req() req: Request, @Body() body: RegisterUserRequestDto) {
    return this.authService.registerUser(body);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify user' })
  @ApiBody({
    type: VerifyUserRequestDto,
  })
  async verify(
    @Req() req: Request,
    @Body() body: VerifyUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = this.authService.verifyUser(body);
    return this.setAuthCookies(auth, req, res);
  }

  @Post('authenticate')
  @ApiOperation({ summary: 'Authenticate user' })
  async authenticate(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Get access and refresh tokens from cookies
    const accessToken = getAccessToken(req);

    if (!accessToken) {
      throw new UnauthorizedException('Authentication tokens not found');
    }
    const auth = this.authService.authenticate({ accessToken });
    return this.setAuthCookies(auth, req, res);
  }

  @Post('recover')
  @ApiOperation({ summary: 'Recover user account' })
  @ApiBody({
    type: RecoverUserRequestDto,
  })
  async recover(
    @Req() req: Request,
    @Body() body: RecoverUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = this.authService.recoverUser(body);
    return this.setAuthCookies(auth, req, res);
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

  private async setAuthCookies(
    auth: Observable<AuthResponse>,
    req: Request,
    res: Response,
  ) {
    return firstValueFrom(auth).then(
      ({ user, accessToken, refreshToken }: AuthResponse) => {
        if (accessToken) {
          const { user: jwtUser, expires } =
            this.jwtService.decode<AuthTokenPayload>(accessToken);

          if (user.id !== jwtUser.id) {
            this.logger.error('Invalid auth response');
          }

          // Set cookies for browser requests
          if (this.isBrowserRequest(req)) {
            res.cookie('Authentication', accessToken, {
              httpOnly: true,
              secure: true,
              sameSite: 'none',
              expires: new Date(expires),
            });

            if (refreshToken) {
              res.cookie('RefreshToken', refreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                path: '/auth/refresh',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
              });
            }

            // Return minimal response for browser
            return {
              user,
              authenticated: true,
            };
          }

          // Return tokens in body for non-browser clients
          return {
            user,
            authenticated: true,
            accessToken,
            refreshToken,
          };
        }

        return {
          user,
          authenticated: false,
        };
      },
    );
  }

  private isBrowserRequest(req: Request): boolean {
    const userAgent = req.headers?.['user-agent'] || '';
    return (
      userAgent.includes('Mozilla/') ||
      userAgent.includes('Chrome/') ||
      userAgent.includes('Safari/')
    );
  }
}
