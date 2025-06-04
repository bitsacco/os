import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConnectionManagerService } from '../services/connection-manager.service';
import { MetricsService } from '../../../infrastructure/monitoring/metrics.service';
import { DomainEvent } from '../../../shared/domain/base-domain.service';
import { WsJwtGuard } from '../guards/ws-jwt.guard';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

@WebSocketGateway({
  port: parseInt(process.env.WEBSOCKET_PORT || '4001'),
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly connectionManager: ConnectionManagerService,
    private readonly metricsService: MetricsService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Basic connection logging
      this.logger.log(`Client connected: ${client.id}`);

      // Update metrics
      this.metricsService.incrementWebSocketConnections();

      // Store connection
      await this.connectionManager.addConnection(client);

      // Send welcome message
      client.emit('connected', {
        message: 'Connected to Bitsacco Events',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Error handling connection', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    try {
      this.logger.log(`Client disconnected: ${client.id}`);

      // Update metrics
      this.metricsService.decrementWebSocketConnections();

      // Remove connection
      await this.connectionManager.removeConnection(client.id);
    } catch (error) {
      this.logger.error('Error handling disconnection', error);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('authenticate')
  async handleAuthentication(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { token: string },
  ) {
    try {
      // Authentication is handled by the guard
      // At this point, client.user should be set

      if (client.user) {
        client.userId = client.user.userId;

        // Join user-specific room
        await client.join(`user:${client.userId}`);

        // Update connection with user info
        await this.connectionManager.authenticateConnection(
          client.id,
          client.user,
        );

        client.emit('authenticated', {
          success: true,
          user: client.user,
          timestamp: new Date().toISOString(),
        });

        this.logger.log(
          `Client authenticated: ${client.id} (User: ${client.userId})`,
        );
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      this.logger.error('Authentication error', error);
      client.emit('authentication_error', {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscription(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { events: string[] },
  ) {
    try {
      if (!client.userId) {
        client.emit('subscription_error', {
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Join event-specific rooms
      for (const eventType of data.events) {
        await client.join(`event:${eventType}`);
        await client.join(`user:${client.userId}:${eventType}`);
      }

      client.emit('subscribed', {
        success: true,
        events: data.events,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Client subscribed to events: ${data.events.join(', ')}`);
    } catch (error) {
      this.logger.error('Subscription error', error);
      client.emit('subscription_error', {
        success: false,
        message: error.message,
      });
    }
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscription(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { events: string[] },
  ) {
    try {
      // Leave event-specific rooms
      for (const eventType of data.events) {
        await client.leave(`event:${eventType}`);
        await client.leave(`user:${client.userId}:${eventType}`);
      }

      client.emit('unsubscribed', {
        success: true,
        events: data.events,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Client unsubscribed from events: ${data.events.join(', ')}`,
      );
    } catch (error) {
      this.logger.error('Unsubscription error', error);
    }
  }

  // Event listeners for domain events
  @OnEvent('user.*')
  handleUserEvents(event: DomainEvent) {
    this.broadcastEvent('user', event);
  }

  @OnEvent('chama.*')
  handleChamaEvents(event: DomainEvent) {
    this.broadcastEvent('chama', event);
  }

  @OnEvent('wallet.*')
  handleWalletEvents(event: DomainEvent) {
    this.broadcastEvent('wallet', event);
  }

  @OnEvent('notification.*')
  handleNotificationEvents(event: DomainEvent) {
    this.broadcastEvent('notification', event);
  }

  @OnEvent('shares.*')
  handleSharesEvents(event: DomainEvent) {
    this.broadcastEvent('shares', event);
  }

  // Generic event broadcasting
  private broadcastEvent(category: string, event: DomainEvent) {
    try {
      const eventData = {
        ...event,
        category,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to all clients subscribed to this event type
      this.server
        .to(`event:${event.eventType}`)
        .emit('domain_event', eventData);

      // Broadcast to specific user if userId is present
      if (event.userId) {
        this.server.to(`user:${event.userId}`).emit('domain_event', eventData);
        this.server
          .to(`user:${event.userId}:${event.eventType}`)
          .emit('domain_event', eventData);
      }

      this.logger.debug(`Broadcasted event: ${event.eventType}`, {
        aggregateId: event.aggregateId,
        userId: event.userId,
      });
    } catch (error) {
      this.logger.error('Error broadcasting event', error);
    }
  }

  // Public methods for external use
  async broadcastToUser(userId: string, event: any) {
    this.server.to(`user:${userId}`).emit('notification', event);
  }

  async broadcastToChama(chamaId: string, event: any) {
    this.server.to(`chama:${chamaId}`).emit('chama_event', event);
  }

  async broadcastSystemMessage(message: any) {
    this.server.emit('system_message', {
      ...message,
      timestamp: new Date().toISOString(),
    });
  }
}
