import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  type WsResponse,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import {
  notification_created,
  notification_delivered,
  notification_preferences_updated,
  type NotificationCreatedEvent,
} from '@bitsacco/common';
import { NotificationService } from './notification.service';
import {
  GetNotificationsDto,
  GetNotificationsResponseDto,
  MarkAsReadDto,
  MarkAsReadResponseDto,
  NotificationSubscribeDto,
  NotificationSubscribeResponseDto,
  UpdatePreferencesDto,
  UpdatePreferencesResponseDto,
  NotificationCreatedEventDto,
  NotificationDeliveredEventDto,
  PreferencesUpdatedEventDto,
} from './dto/notification.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'notifications',
})
@ApiTags('Notifications WebSocket')
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  @WebSocketServer()
  server: Server;

  constructor(private readonly notificationService: NotificationService) {}

  afterInit() {
    this.logger.log('Notification WebSocket Gateway initialized');

    // Log connection info for debugging
    const port = process.env.PORT || 4000;
    this.logger.log(
      `WebSocket server ready at ws://localhost:${port}/notifications`,
    );

    // Use EventPattern decorators instead of direct subscribe
    this.logger.log(
      'Notification WebSocket Gateway initialized with event listeners',
    );
  }

  handleConnection(client: Socket) {
    // Log basic connection info
    this.logger.log(`WebSocket connection attempt from client: ${client.id}`);

    // Extract user info
    const userId = this.getUserIdFromToken(client);
    if (!userId) {
      this.logger.warn(
        `WebSocket connection rejected - invalid credentials for client: ${client.id}`,
      );
      client.disconnect();
      return;
    }

    // Register the user's socket
    this.registerUserSocket(userId, client.id);

    // Enhanced connection logging with client info
    const userAgent = client.handshake.headers['user-agent'] || 'Unknown';
    const ip = client.handshake.address || 'Unknown';
    const origin = client.handshake.headers.origin || 'Unknown';

    this.logger.log(
      `WebSocket connection successful! Client: ${client.id}, User: ${userId}
      IP: ${ip}
      Origin: ${origin}
      User Agent: ${userAgent}
      Active connections for this user: ${this.userSockets.get(userId)?.size || 0}`,
    );

    // Emit a welcome event to the client
    client.emit('connection:established', {
      status: 'connected',
      timestamp: Date.now(),
      userId: userId,
    });
  }

  handleDisconnect(client: Socket) {
    // Basic disconnect info
    this.logger.log(`WebSocket disconnect event from client: ${client.id}`);

    const userId = this.getUserIdFromToken(client);
    if (userId) {
      // Get count before removing
      const connectionCount = this.userSockets.get(userId)?.size || 0;

      // Remove the socket
      this.removeUserSocket(userId, client.id);

      // Log detailed disconnect info
      this.logger.log(
        `WebSocket client disconnected: ${client.id}, User: ${userId}
        Remaining connections for this user: ${connectionCount - 1}`,
      );
    } else {
      this.logger.log(
        `WebSocket client disconnected: ${client.id} (Unknown user)`,
      );
    }
  }

  @SubscribeMessage('subscribe')
  @ApiOperation({ summary: 'Subscribe to notification topics' })
  @ApiBody({ type: NotificationSubscribeDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully subscribed to topics',
    type: NotificationSubscribeResponseDto,
  })
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: NotificationSubscribeDto,
  ): WsResponse<NotificationSubscribeResponseDto> {
    if (!data) {
      return { event: 'subscribe', data: { success: false, topics: [] } };
    }

    const { topics } = data;
    if (!topics || !Array.isArray(topics))
      return { event: 'subscribe', data: { success: false, topics: [] } };

    // Join client to specific topic rooms
    topics.forEach((topic) => {
      client.join(topic);
    });

    return { event: 'subscribe', data: { success: true, topics } };
  }

  @SubscribeMessage('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from notification topics' })
  @ApiBody({ type: NotificationSubscribeDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully unsubscribed from topics',
    type: NotificationSubscribeResponseDto,
  })
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: NotificationSubscribeDto,
  ): WsResponse<NotificationSubscribeResponseDto> {
    if (!data) {
      return { event: 'unsubscribe', data: { success: false, topics: [] } };
    }

    const { topics } = data;
    if (!topics || !Array.isArray(topics))
      return { event: 'unsubscribe', data: { success: false, topics: [] } };

    // Remove client from specific topic rooms
    topics.forEach((topic) => {
      client.leave(topic);
    });

    return { event: 'unsubscribe', data: { success: true, topics } };
  }

  @SubscribeMessage('getNotifications')
  @ApiOperation({
    summary: 'Get user notifications with filtering and pagination',
  })
  @ApiBody({ type: GetNotificationsDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved notifications',
    type: GetNotificationsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async handleGetNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GetNotificationsDto,
  ): Promise<
    WsResponse<GetNotificationsResponseDto | { success: false; error: string }>
  > {
    const userId = this.getUserIdFromToken(client);
    if (!userId)
      return {
        event: 'getNotifications',
        data: { success: false, error: 'Unauthorized' },
      };

    try {
      const {
        unreadOnly = false,
        page = 0,
        size = 10,
        topics = [],
      } = data || {};

      const result = await this.notificationService.getNotifications(
        userId,
        unreadOnly,
        { page, size },
        topics,
      );

      return {
        event: 'getNotifications',
        data: { success: true, data: result },
      };
    } catch (error) {
      this.logger.error(
        `Error getting notifications for user ${userId}`,
        error.stack,
      );
      return {
        event: 'getNotifications',
        data: { success: false, error: 'Failed to retrieve notifications' },
      };
    }
  }

  @SubscribeMessage('markAsRead')
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiBody({ type: MarkAsReadDto })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as read successfully',
    type: MarkAsReadResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MarkAsReadDto,
  ): Promise<
    WsResponse<MarkAsReadResponseDto | { success: false; error: string }>
  > {
    const userId = this.getUserIdFromToken(client);
    if (!userId)
      return {
        event: 'markAsRead',
        data: { success: false, error: 'Unauthorized' },
      };

    try {
      const { notificationIds = [] } = data || {};

      await this.notificationService.markAsRead(userId, notificationIds);

      return {
        event: 'markAsRead',
        data: { success: true },
      };
    } catch (error) {
      this.logger.error(
        `Error marking notifications as read for user ${userId}`,
        error.stack,
      );
      return {
        event: 'markAsRead',
        data: { success: false, error: 'Failed to mark notifications as read' },
      };
    }
  }

  @SubscribeMessage('updatePreferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiBody({ type: UpdatePreferencesDto })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
    type: UpdatePreferencesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async handleUpdatePreferences(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UpdatePreferencesDto,
  ): Promise<
    WsResponse<UpdatePreferencesResponseDto | { success: false; error: string }>
  > {
    const userId = this.getUserIdFromToken(client);
    if (!userId)
      return {
        event: 'updatePreferences',
        data: { success: false, error: 'Unauthorized' },
      };

    try {
      const { channels = [], topics = [] } = data || {};

      await this.notificationService.updatePreferences(
        userId,
        channels,
        topics,
      );

      return {
        event: 'updatePreferences',
        data: { success: true },
      };
    } catch (error) {
      this.logger.error(
        `Error updating preferences for user ${userId}`,
        error.stack,
      );
      return {
        event: 'updatePreferences',
        data: { success: false, error: 'Failed to update preferences' },
      };
    }
  }

  /**
   * Server emits 'notification:created' event when a new notification is created
   *
   * @ApiResponse Event response type: NotificationCreatedEventDto
   */
  @OnEvent(notification_created)
  @ApiResponse({
    description: 'Server emits when a new notification is created',
    type: NotificationCreatedEventDto,
    status: 200,
  })
  handleNotificationCreated(payload: NotificationCreatedEvent) {
    const { userId, notificationId, title, body, topic, importance, channels } =
      payload;

    // Emit to the specific user if connected
    this.emitToUser(userId, 'notification:created', {
      id: notificationId,
      title,
      body,
      topic,
      importance,
      read: false,
      createdAt: Date.now(),
    });

    // Also emit to topic room if available
    if (topic !== undefined) {
      this.server.to(`topic:${topic}`).emit('notification:topic', {
        id: notificationId,
        userId,
        title,
        body,
        topic,
        importance,
        read: false,
        createdAt: Date.now(),
      });
    }
  }

  /**
   * Server emits 'notification:delivered' event when a notification is delivered
   *
   * @ApiResponse Event response type: NotificationDeliveredEventDto
   */
  @OnEvent(notification_delivered)
  @ApiResponse({
    description:
      'Server emits when a notification is delivered through a channel',
    type: NotificationDeliveredEventDto,
    status: 200,
  })
  protected handleNotificationDelivered(payload) {
    const { userId, notificationId, channel, success } = payload;

    // Emit delivery status to user
    this.emitToUser(userId, 'notification:delivered', {
      id: notificationId,
      channel,
      success,
    });
  }

  /**
   * Server emits 'preferences:updated' event when user preferences are updated
   *
   * @ApiResponse Event response type: PreferencesUpdatedEventDto
   */
  @OnEvent(notification_preferences_updated)
  @ApiResponse({
    description: 'Server emits when notification preferences are updated',
    type: PreferencesUpdatedEventDto,
    status: 200,
  })
  handlePreferencesUpdated(payload) {
    const { userId } = payload;

    // Emit preferences updated event to user
    this.emitToUser(userId, 'preferences:updated', {
      timestamp: Date.now(),
    });
  }

  private emitToUser(userId: string, event: string, data: any) {
    const userSocketIds = this.userSockets.get(userId);
    if (!userSocketIds) return;

    userSocketIds.forEach((socketId) => {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(event, data);
      }
    });
  }

  private getUserIdFromToken(client: Socket): string | null {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) return null;

      // Extract user ID from the JWT token
      // This is a simplification - you would use your JwtService to verify and decode
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString(),
      );

      return payload.sub || null;
    } catch (error) {
      this.logger.error(
        `Error extracting user ID from token: ${error.message}`,
      );
      return null;
    }
  }

  private registerUserSocket(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socketId);
  }

  private removeUserSocket(userId: string, socketId: string) {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }
}
