import { Global, Module } from '@nestjs/common';
import { MemoryRateLimitStorage } from './memory.storage';
import { CommonRateLimitService } from './common-rate-limit.service';

/**
 * Rate Limiting Module
 *
 * Provides common rate limiting services across the application.
 * Marked as @Global to make it available everywhere without explicit imports.
 */
@Global()
@Module({
  providers: [MemoryRateLimitStorage, CommonRateLimitService],
  exports: [CommonRateLimitService],
})
export class RateLimitingModule {}
