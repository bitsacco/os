import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiKeyScopes,
  ApiKeyScope,
  RequireApiKey,
  Public,
} from '@bitsacco/common';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';

@Controller('health')
export class HealthController {
  private readonly startupTime: Date;
  private readonly environment: string;
  private readonly version: string;

  constructor(private readonly configService: ConfigService) {
    this.startupTime = new Date();
    this.environment = this.configService.get('NODE_ENV', 'development');
    this.version = this.configService.get('APP_VERSION', '0.0.1');
  }

  @Get()
  @UseGuards(CombinedAuthGuard)
  @RequireApiKey()
  @ApiKeyScopes(ApiKeyScope.ServiceAuth)
  getHealth() {
    const uptime = Math.floor((Date.now() - this.startupTime.getTime()) / 1000);

    return {
      status: 'ok',
      service: 'api-gateway',
      environment: this.environment,
      version: this.version,
      timestamp: new Date().toISOString(),
      uptime: `${uptime} seconds`,
    };
  }

  @Get('readiness')
  @Public()
  getReadiness() {
    return {
      status: 'ok',
      message: 'API Gateway is ready to accept connections',
    };
  }

  @Get('liveness')
  @Public()
  getLiveness() {
    return {
      status: 'ok',
      message: 'API Gateway is alive',
    };
  }

  @Get('public')
  @Public()
  getPublicHealth() {
    return {
      status: 'ok',
      service: 'api-gateway',
      environment: this.environment,
      message:
        'This is a public health endpoint that does not require authentication',
    };
  }
}
