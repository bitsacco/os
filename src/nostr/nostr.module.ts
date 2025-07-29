import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import {
  // RedisProvider,
  RoleValidationService,
} from '../common';
import { AuthModule } from '../auth/auth.module';
import { NostrController } from './nostr.controller';
import { NostrService } from './nostr.service';
import { NostrMetricsService } from './nostr.metrics';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [NostrController],
  providers: [
    NostrService,
    NostrMetricsService,
    // RedisProvider,
    RoleValidationService,
  ],
  exports: [NostrService],
})
export class NostrModule {}
