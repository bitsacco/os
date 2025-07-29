import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
}
