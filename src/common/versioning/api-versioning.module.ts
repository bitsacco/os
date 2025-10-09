import { Module, Global } from '@nestjs/common';
import { ApiVersioningService } from './api-versioning.service';

/**
 * Global module for API versioning functionality
 * Provides versioning services and utilities across the application
 */
@Global()
@Module({
  providers: [ApiVersioningService],
  exports: [ApiVersioningService],
})
export class ApiVersioningModule {}
