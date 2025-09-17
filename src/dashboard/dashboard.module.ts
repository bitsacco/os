import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardGateway } from './dashboard.gateway';
import { BusinessMetricsService } from '../common/monitoring/business.metrics';
import { SharesMetricsService } from '../shares/shares.metrics';
import { ChamaMetricsService } from '../chamas/chama.metrics';
import { TransactionMetricsService } from '../common/monitoring/transaction.metrics';
import { SwapMetricsService } from '../swap/metrics/swap.metrics';
import { SolowalletMetricsService } from '../solowallet/solowallet.metrics';
import { NotificationMetrics } from '../notifications/notification.metrics';
import { NostrMetricsService } from '../nostr/nostr.metrics';
import { LnurlMetricsService } from '../lnurl/lnurl.metrics';
import { AuthMetricsService } from '../auth/metrics/auth.metrics';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300, // 5 minutes default TTL
      max: 100, // Maximum number of items in cache
    }),
    EventEmitterModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardGateway,
    BusinessMetricsService,
    SharesMetricsService,
    ChamaMetricsService,
    TransactionMetricsService,
    SwapMetricsService,
    SolowalletMetricsService,
    NotificationMetrics,
    NostrMetricsService,
    LnurlMetricsService,
    AuthMetricsService,
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
