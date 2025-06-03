import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

// Infrastructure modules
import { DatabaseModule } from './infrastructure/database/database.module';
import { MonitoringModule } from './infrastructure/monitoring/monitoring.module';
import { SecurityModule } from './infrastructure/security/security.module';
import { MessagingModule } from './infrastructure/messaging/messaging.module';

// API modules
import { RestApiModule } from './api/rest/rest-api.module';
import { WebSocketModule } from './api/websocket/websocket.module';

// Domain modules
import { AuthDomainModule } from './domains/auth/auth-domain.module';
import { ChamasDomainModule } from './domains/chamas/chamas-domain.module';
import { WalletsDomainModule } from './domains/wallets/wallets-domain.module';
import { SharesDomainModule } from './domains/shares/shares-domain.module';
import { NotificationsDomainModule } from './domains/notifications/notifications-domain.module';
import { CommunicationsDomainModule } from './domains/communications/communications-domain.module';

// Health check
import { HealthController } from './infrastructure/health/health.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      expandVariables: true,
    }),

    // Event system
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Health checks
    TerminusModule,

    // Infrastructure
    DatabaseModule,
    MonitoringModule,
    SecurityModule,
    MessagingModule,

    // API layers
    RestApiModule,
    WebSocketModule,

    // Domain modules
    AuthDomainModule,
    ChamasDomainModule,
    WalletsDomainModule,
    SharesDomainModule,
    NotificationsDomainModule,
    CommunicationsDomainModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
