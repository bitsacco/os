import { firstValueFrom, Observable } from 'rxjs';
import { type Request, type Response } from 'express';
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
  CircuitBreakerService,
  HandleServiceErrors,
  GrpcServiceWrapper,
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
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly grpcWrapper: GrpcServiceWrapper,
  ) {
    this.authService = this.grpcWrapper.createServiceProxy<AuthServiceClient>(
      this.grpc,
      'AUTH_SERVICE',
      AUTH_SERVICE_NAME,
    );
    this.logger.debug('AuthController initialized');
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({
    type: LoginUserRequestDto,
  })
  @HandleServiceErrors()
  async login(
    @Req() req: Request,
    @Body() body: LoginUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = this.circuitBreaker.execute(
      'auth-service-login',
      this.authService.loginUser(body),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
    return this.setAuthCookies(auth, req, res);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register user' })
  @ApiBody({
    type: RegisterUserRequestDto,
  })
  @HandleServiceErrors()
  register(@Req() req: Request, @Body() body: RegisterUserRequestDto) {
    return this.circuitBreaker.execute(
      'auth-service-register',
      this.authService.registerUser(body),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify user' })
  @ApiBody({
    type: VerifyUserRequestDto,
  })
  @HandleServiceErrors()
  async verify(
    @Req() req: Request,
    @Body() body: VerifyUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = this.circuitBreaker.execute(
      'auth-service-verify',
      this.authService.verifyUser(body),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
    return this.setAuthCookies(auth, req, res);
  }

  @Post('authenticate')
  @ApiOperation({ summary: 'Authenticate user' })
  @HandleServiceErrors()
  async authenticate(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Get access and refresh tokens from cookies
    const accessToken = getAccessToken(req, this.logger);

    if (!accessToken) {
      throw new UnauthorizedException('Authentication tokens not found');
    }
    const auth = this.circuitBreaker.execute(
      'auth-service-authenticate',
      this.authService.authenticate({ accessToken }),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
    return this.setAuthCookies(auth, req, res);
  }

  @Post('recover')
  @ApiOperation({ summary: 'Recover user account' })
  @ApiBody({
    type: RecoverUserRequestDto,
  })
  @HandleServiceErrors()
  async recover(
    @Req() req: Request,
    @Body() body: RecoverUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = this.circuitBreaker.execute(
      'auth-service-recover',
      this.authService.recoverUser(body),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
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
    const tokensResponse = this.circuitBreaker.execute(
      'auth-service-refresh',
      this.authService.refreshToken(refreshRequest),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );

    return firstValueFrom(tokensResponse).then(
      ({ accessToken, refreshToken }) => {
        // Set the new access token cookie
        const accessTokenPayload = this.jwtService.decode<
          AuthTokenPayload & { exp: number }
        >(accessToken);
        res.cookie('Authentication', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires: new Date(accessTokenPayload.exp * 1000), // exp is in seconds since epoch
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
        this.circuitBreaker.execute(
          'auth-service-revoke',
          this.authService.revokeToken(revokeRequest),
          {
            failureThreshold: 3,
            resetTimeout: 10000,
            fallbackResponse: { success: false },
          },
        ),
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
          const decodedToken = this.jwtService.decode<
            AuthTokenPayload & { exp: number }
          >(accessToken);
          const { user: jwtUser, exp } = decodedToken;

          if (user.id !== jwtUser.id) {
            this.logger.error('Invalid auth response');
          }

          // Always set cookies
          res.cookie('Authentication', accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            expires: new Date(exp * 1000), // exp is in seconds since epoch
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

          // Always return tokens in the response
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
}
