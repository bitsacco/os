import { type Request, type Response } from 'express';
import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiTags,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import {
  AuthResponse,
  AuthTokenPayload,
  getAccessToken,
  LoginUserRequestDto,
  RecoverUserRequestDto,
  RegisterUserRequestDto,
  RevokeTokenResponseDto,
  TokensResponseDto,
  VerifyUserRequestDto,
  HandleServiceErrors,
  JwtAuthGuard,
  CurrentUser,
  type User,
} from '../common';
import { AuthService } from './auth.service';

/**
 * AuthController - REST-compliant API endpoints for authentication
 *
 * This controller maintains the same auth patterns as v1 since auth operations
 * don't typically operate on existing resources in the same way CRUD operations do.
 * The main changes are organizational - using version: '2' and proper REST status codes.
 *
 * Key improvements:
 * - Consistent use of HTTP status codes
 * - Clear separation of authentication vs user resource operations
 * - Proper cookie handling for token management
 */
@ApiTags('auth')
@Controller({
  path: 'auth',
  version: '2',
})
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {
    this.logger.log('AuthController initialized - REST-compliant endpoints');
  }

  /**
   * Login user
   * POST /api/v2/auth/login
   */
  @Post('login')
  @ApiOperation({
    summary: 'Login user',
    description:
      'Authenticate user with credentials and create session tokens.',
  })
  @ApiBody({
    type: LoginUserRequestDto,
    description: 'User login credentials',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
  })
  @HttpCode(HttpStatus.OK)
  @HandleServiceErrors()
  async login(
    @Req() req: Request,
    @Body() body: LoginUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log('Processing login request');
    const auth = await this.authService.loginUser(body);
    return this.setAuthCookies(auth, req, res);
  }

  /**
   * Register new user
   * POST /api/v2/auth/register
   */
  @Post('register')
  @ApiOperation({
    summary: 'Register new user',
    description: 'Create a new user account with the provided information.',
  })
  @ApiBody({
    type: RegisterUserRequestDto,
    description: 'User registration details',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  @HandleServiceErrors()
  async register(@Body() body: RegisterUserRequestDto) {
    this.logger.log('Processing registration request');
    return await this.authService.registerUser(body);
  }

  /**
   * Verify user account
   * POST /api/v2/auth/verify
   */
  @Post('verify')
  @ApiOperation({
    summary: 'Verify user account',
    description: 'Verify user account with OTP or other verification method.',
  })
  @ApiBody({
    type: VerifyUserRequestDto,
    description: 'User verification details',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User verified successfully',
  })
  @HttpCode(HttpStatus.OK)
  @HandleServiceErrors()
  async verify(
    @Req() req: Request,
    @Body() body: VerifyUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log('Processing verification request');
    const auth = await this.authService.verifyUser(body);
    return this.setAuthCookies(auth, req, res);
  }

  /**
   * Authenticate current session
   * POST /api/v2/auth/authenticate
   */
  @Post('authenticate')
  @ApiOperation({
    summary: 'Authenticate current session',
    description:
      'Validate current authentication tokens and refresh if needed.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Authentication validated successfully',
  })
  @HttpCode(HttpStatus.OK)
  @HandleServiceErrors()
  async authenticate(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log('Validating authentication');

    // Get access token from cookies or headers
    const accessToken = getAccessToken(req, this.logger);

    if (!accessToken) {
      throw new UnauthorizedException('Authentication tokens not found');
    }

    const auth = await this.authService.authenticate({ accessToken });
    return this.setAuthCookies(auth, req, res);
  }

  /**
   * Recover user account
   * POST /api/v2/auth/recover
   */
  @Post('recover')
  @ApiOperation({
    summary: 'Recover user account',
    description: 'Initiate account recovery process for forgotten credentials.',
  })
  @ApiBody({
    type: RecoverUserRequestDto,
    description: 'Account recovery details',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Recovery process initiated',
  })
  @HttpCode(HttpStatus.OK)
  @HandleServiceErrors()
  async recover(
    @Req() req: Request,
    @Body() body: RecoverUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log('Processing account recovery');
    const auth = await this.authService.recoverUser(body);
    return this.setAuthCookies(auth, req, res);
  }

  /**
   * Refresh access token
   * POST /api/v2/auth/refresh
   */
  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Use refresh token to obtain a new access token.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens refreshed successfully',
    type: TokensResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @HandleServiceErrors()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log('Refreshing tokens');

    const refreshToken = req.cookies?.RefreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshToken(refreshToken);

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
    res.cookie('RefreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v2/auth/refresh', // Only sent to v2 refresh endpoint
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      message: 'Tokens refreshed successfully',
    };
  }

  /**
   * Logout user
   * POST /api/v2/auth/logout
   */
  @Post('logout')
  @ApiOperation({
    summary: 'Logout user',
    description: 'Revoke current session and clear authentication tokens.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logged out successfully',
    type: RevokeTokenResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @HandleServiceErrors()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.logger.log('Processing logout');

    const refreshToken = req.cookies?.RefreshToken;
    let success = true;

    if (refreshToken) {
      // Attempt to revoke the token
      success = await this.authService.revokeToken(refreshToken);
    }

    // Clear cookies regardless of token revocation success
    res.clearCookie('Authentication');
    res.clearCookie('RefreshToken');

    return {
      success,
      message: 'Logged out successfully',
    };
  }

  /**
   * Get current authenticated user
   * GET /api/v2/auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get current authenticated user',
    description: 'Retrieve information about the currently authenticated user.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user information retrieved',
  })
  @HandleServiceErrors()
  async getCurrentUser(@CurrentUser() user: User) {
    this.logger.log(`Getting current user info: ${user.id}`);
    // Return the current user from the JWT token
    return user;
  }

  /**
   * Private helper method to set authentication cookies
   */
  private async setAuthCookies(
    auth: AuthResponse,
    _req: Request,
    res: Response,
  ) {
    const { user, accessToken, refreshToken } = auth;

    if (accessToken) {
      const decodedToken = this.jwtService.decode<
        AuthTokenPayload & { exp: number }
      >(accessToken);
      const { user: jwtUser, exp } = decodedToken;

      if (user.id !== jwtUser.id) {
        this.logger.error('Invalid auth response - user ID mismatch');
      }

      // Set authentication cookies with v2 paths
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
          path: '/api/v2/auth/refresh', // v2 refresh endpoint path
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
      }

      // Return tokens in the response
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
  }
}
