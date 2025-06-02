import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Gateways
import { EventsGateway } from './gateways/events.gateway';

// Services
import { WebSocketService } from './services/websocket.service';
import { ConnectionManagerService } from './services/connection-manager.service';

// Domain modules
import { AuthDomainModule } from '../../domains/auth/auth-domain.module';
import { NotificationsDomainModule } from '../../domains/notifications/notifications-domain.module';
import { ChamasDomainModule } from '../../domains/chamas/chamas-domain.module';

@Module({
  imports: [
    ConfigModule,
    AuthDomainModule,
    NotificationsDomainModule,
    ChamasDomainModule,
  ],
  providers: [
    // Gateways
    EventsGateway,

    // Services
    WebSocketService,
    ConnectionManagerService,
  ],
  exports: [WebSocketService, ConnectionManagerService],
})
export class WebSocketModule {}
