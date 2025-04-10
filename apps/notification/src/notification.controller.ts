import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  Empty,
  GetNotificationsResponse,
  GetPreferencesResponse,
  SendNotificationResponse,
  type GetNotificationsRequest,
  type MarkAsReadRequest,
  type SendNotificationRequest,
  type GetPreferencesRequest,
  type UpdatePreferencesRequest,
} from '@bitsacco/common';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @GrpcMethod('NotificationService', 'GetPreferences')
  async getPreferences(
    request: GetPreferencesRequest,
  ): Promise<GetPreferencesResponse> {
    const { userId } = request;
    return this.notificationService.getPreferences(userId);
  }

  @GrpcMethod('NotificationService', 'UpdatePreferences')
  async updatePreferences(request: UpdatePreferencesRequest): Promise<Empty> {
    const { userId, channels, topics } = request;
    return this.notificationService.updatePreferences(userId, channels, topics);
  }

  @GrpcMethod('NotificationService', 'GetNotifications')
  async getNotifications(
    request: GetNotificationsRequest,
  ): Promise<GetNotificationsResponse> {
    const { userId, unreadOnly, pagination, topics } = request;
    return this.notificationService.getNotifications(
      userId,
      unreadOnly,
      pagination,
      topics,
    );
  }

  @GrpcMethod('NotificationService', 'MarkAsRead')
  async markAsRead(request: MarkAsReadRequest): Promise<Empty> {
    const { userId, notificationIds } = request;
    return this.notificationService.markAsRead(userId, notificationIds);
  }

  @GrpcMethod('NotificationService', 'SendNotification')
  async sendNotification(
    request: SendNotificationRequest,
  ): Promise<SendNotificationResponse> {
    const { userId, title, body, topic, metadata, importance, channels } =
      request;
    return this.notificationService.sendNotification(
      userId,
      title,
      body,
      topic,
      metadata || {},
      importance,
      channels,
    );
  }
}
