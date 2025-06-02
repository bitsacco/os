import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  MinLength,
} from 'class-validator';
import { AuthService } from '../../../domains/auth/services/auth.service';
import { JwtAuthGuard } from '../../../domains/auth/guards/jwt-auth.guard';

// DTOs
export class RegisterDto {
  @IsPhoneNumber()
  phone: string;

  @IsString()
  @MinLength(4)
  pin: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  npub?: string;
}

export class LoginDto {
  @IsPhoneNumber()
  phone: string;

  @IsString()
  @MinLength(4)
  pin: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  otp?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  refreshToken: string;
}

export class SendOtpDto {
  @IsPhoneNumber()
  phone: string;
}

export class VerifyOtpDto {
  @IsPhoneNumber()
  phone: string;

  @IsString()
  @MinLength(6)
  otp: string;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - User already exists or invalid data',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async register(@Body() registerDto: RegisterDto, @Res() res: any) {
    const result = await this.authService.registerUser(registerDto);
    const requestId = 'req_' + Date.now();

    res.header('x-request-id', requestId);

    return res.status(201).json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        path: '/auth/register',
        method: 'POST',
        statusCode: 201,
      },
    });
  }

  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async login(@Body() loginDto: LoginDto, @Res() res: any) {
    const result = await this.authService.loginUser(loginDto);
    const requestId = 'req_' + Date.now();

    res.header('x-request-id', requestId);

    return res.status(200).json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        path: '/auth/login',
        method: 'POST',
        statusCode: 200,
      },
    });
  }

  @Post('refresh')
  @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 attempts per minute
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res() res: any,
  ) {
    const result = await this.authService.refreshToken(refreshTokenDto);
    const requestId = 'req_' + Date.now();

    res.header('x-request-id', requestId);

    return res.status(200).json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        path: '/auth/refresh',
        method: 'POST',
        statusCode: 200,
      },
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 204, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Body() refreshTokenDto: RefreshTokenDto, @Res() res: any) {
    await this.authService.revokeToken(refreshTokenDto);
    return res.status(204).send();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req, @Res() res: any) {
    const result = await this.authService.validateUser(req.user.userId);
    const requestId = 'req_' + Date.now();

    res.header('x-request-id', requestId);

    return res.status(200).json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        path: '/auth/profile',
        method: 'GET',
        statusCode: 200,
      },
    });
  }

  @Post('send-otp')
  @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @ApiOperation({ summary: 'Send OTP to phone number' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid phone number' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto, @Res() res: any) {
    // TODO: Implement OTP sending via SMS service
    const requestId = 'req_' + Date.now();

    res.header('x-request-id', requestId);

    return res.status(200).json({
      success: true,
      data: { message: 'OTP sent successfully' },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        path: '/auth/send-otp',
        method: 'POST',
        statusCode: 200,
      },
    });
  }

  @Post('verify-otp')
  @Throttle({ short: { limit: 5, ttl: 300000 } }) // 5 attempts per 5 minutes
  @ApiOperation({ summary: 'Verify OTP' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto, @Res() res: any) {
    // TODO: Implement OTP verification
    const requestId = 'req_' + Date.now();

    res.header('x-request-id', requestId);

    return res.status(200).json({
      success: true,
      data: { message: 'OTP verified successfully' },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        path: '/auth/verify-otp',
        method: 'POST',
        statusCode: 200,
      },
    });
  }
}
