import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

// Controllers
import { AuthController } from './controllers/auth.controller';

// Domain modules
import { AuthDomainModule } from '../../domains/auth/auth-domain.module';
import { ChamasDomainModule } from '../../domains/chamas/chamas-domain.module';
import { WalletsDomainModule } from '../../domains/wallets/wallets-domain.module';
import { SharesDomainModule } from '../../domains/shares/shares-domain.module';
import { NotificationsDomainModule } from '../../domains/notifications/notifications-domain.module';
import { CommunicationsDomainModule } from '../../domains/communications/communications-domain.module';

// Interceptors
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { MetricsInterceptor } from './interceptors/metrics.interceptor';

@Module({
  imports: [
    // Rate limiting configuration
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 200,
      },
    ]),

    // Domain modules
    AuthDomainModule,
    ChamasDomainModule,
    WalletsDomainModule,
    SharesDomainModule,
    NotificationsDomainModule,
    CommunicationsDomainModule,
  ],
  controllers: [AuthController],
  providers: [ResponseInterceptor, MetricsInterceptor],
  exports: [ResponseInterceptor, MetricsInterceptor],
})
export class RestApiModule {}
