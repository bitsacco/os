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
// PersonalMetricsService is imported via PersonalModule
import { NotificationMetrics } from '../notifications/notification.metrics';
import { NostrMetricsService } from '../nostr/nostr.metrics';
import { LnurlMetricsService } from '../lnurl/lnurl.metrics';
import { AuthMetricsService } from '../auth/metrics/auth.metrics';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '../common/database/database.module';

// Import metrics persistence infrastructure
import { BusinessMetricsRepository } from './db/business-metrics.repository';
import { FinancialMetricsRepository } from './db/financial-metrics.repository';
import { OperationalMetricsRepository } from './db/operational-metrics.repository';
import { SharesMetricsRepository } from './db/shares-metrics.repository';
import { MetricsCleanupService } from './services/metrics-cleanup.service';
import { MetricsHealthService } from './services/metrics-health.service';

// Import metrics schemas
import {
  BusinessMetrics,
  BusinessMetricsSchema,
} from './db/business-metrics.schema';
import {
  FinancialMetrics,
  FinancialMetricsSchema,
} from './db/financial-metrics.schema';
import {
  OperationalMetrics,
  OperationalMetricsSchema,
} from './db/operational-metrics.schema';
import { SharesMetrics, SharesMetricsSchema } from './db/shares-metrics.schema';
import { PersonalModule } from '../personal/personal.module';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300, // 5 minutes default TTL
      max: 100, // Maximum number of items in cache
    }),
    EventEmitterModule,
    ScheduleModule.forRoot(),
    PersonalModule,

    // Database module for MongoDB schemas
    DatabaseModule.forFeature([
      { name: BusinessMetrics.name, schema: BusinessMetricsSchema },
      { name: FinancialMetrics.name, schema: FinancialMetricsSchema },
      { name: OperationalMetrics.name, schema: OperationalMetricsSchema },
      { name: SharesMetrics.name, schema: SharesMetricsSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [
    // Dashboard services
    DashboardService,
    DashboardGateway,

    // Metrics repositories for persistence
    BusinessMetricsRepository,
    FinancialMetricsRepository,
    OperationalMetricsRepository,
    SharesMetricsRepository,

    // Metrics management services
    MetricsCleanupService,
    MetricsHealthService,

    // Original metrics services (now enhanced with persistence)
    BusinessMetricsService,
    SharesMetricsService,
    ChamaMetricsService,
    TransactionMetricsService,
    SwapMetricsService,
    // PersonalMetricsService is provided by PersonalModule
    NotificationMetrics,
    NostrMetricsService,
    LnurlMetricsService,
    AuthMetricsService,
  ],
  exports: [
    DashboardService,
    BusinessMetricsRepository,
    FinancialMetricsRepository,
    OperationalMetricsRepository,
    SharesMetricsRepository,
    MetricsCleanupService,
    MetricsHealthService,
  ],
})
export class DashboardModule {}
