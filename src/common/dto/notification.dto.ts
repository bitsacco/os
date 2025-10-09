import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  NotificationChannel,
  NotificationTopic,
  NotificationImportance,
  type Notification,
  GetNotificationsResponse,
} from '../../common';

/**
 * DTOs for Notifications Module - REST Compliant
 *
 * These DTOs follow REST principles for resource ownership.
 *
 * - User ID is in URL paths for user-specific operations
 * - Notification IDs in URL paths for specific notification operations
 * - Follows proper REST resource hierarchy: /users/:userId/notifications
 */

/**
 * DTO for subscribing to notification topics * Used with: POST /api/users/:userId/notifications/subscriptions
 */
export class NotificationSubscribeDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @ApiProperty({
    description: 'List of topic identifiers to subscribe to',
    example: ['transaction-123', 'swap-456'],
    type: [String],
  })
  topics: string[];
}

/**
 * Response DTO for notification subscription
 */
export class NotificationSubscribeResponseDto {
  @ApiProperty({
    description: 'Success status of the subscription',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Topics that were subscribed to',
    example: ['transaction-123', 'swap-456'],
    type: [String],
  })
  topics: string[];
}

/**
 * DTO for getting notifications query params * Used with: GET /api/users/:userId/notifications
 */
export class GetNotificationsQueryDto {
  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    description: 'Retrieve only unread notifications',
    example: false,
    required: false,
  })
  unreadOnly?: boolean;

  @IsOptional()
  @IsNumber()
  @ApiProperty({
    description: 'Page number for pagination',
    example: 0,
    required: false,
  })
  page?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    required: false,
  })
  size?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationTopic, { each: true })
  @ApiProperty({
    description: 'Filter notifications by topics',
    enum: NotificationTopic,
    isArray: true,
    required: false,
    example: [NotificationTopic.TRANSACTION],
  })
  topics?: NotificationTopic[];
}

/**
 * DTO for marking notifications as read * Used with: PATCH /api/users/:userId/notifications/read
 *
 * Alternative endpoint for specific notification:
 * PATCH /api/notifications/:notificationId/read
 */
export class MarkNotificationsAsReadDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({
    description:
      'IDs of notifications to mark as read. If empty, marks all user notifications as read.',
    example: ['notification-id-1', 'notification-id-2'],
    required: false,
    type: [String],
  })
  notificationIds?: string[];
}

/**
 * Channel preference DTO */
export class ChannelPreferenceDto {
  @IsEnum(NotificationChannel)
  @ApiProperty({
    description: 'Notification channel type',
    enum: NotificationChannel,
    example: NotificationChannel.IN_APP,
  })
  channel: NotificationChannel;

  @IsBoolean()
  @ApiProperty({
    description: 'Whether the channel is enabled',
    example: true,
  })
  enabled: boolean;
}

/**
 * Topic preference DTO */
export class TopicPreferenceDto {
  @IsEnum(NotificationTopic)
  @ApiProperty({
    description: 'Notification topic type',
    enum: NotificationTopic,
    example: NotificationTopic.TRANSACTION,
  })
  topic: NotificationTopic;

  @IsBoolean()
  @ApiProperty({
    description: 'Whether notifications for this topic are enabled',
    example: true,
  })
  enabled: boolean;

  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  @ApiProperty({
    description:
      'Channels through which to receive notifications for this topic',
    enum: NotificationChannel,
    isArray: true,
    example: [NotificationChannel.IN_APP, NotificationChannel.NOSTR],
  })
  channels: NotificationChannel[];
}

/**
 * DTO for updating notification preferences * Used with: PUT /users/:userId/notifications/preferences
 */
export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsArray()
  @Type(() => ChannelPreferenceDto)
  @ApiProperty({
    description: 'Channel preferences configuration',
    type: [ChannelPreferenceDto],
    required: false,
  })
  channels?: ChannelPreferenceDto[];

  @IsOptional()
  @IsArray()
  @Type(() => TopicPreferenceDto)
  @ApiProperty({
    description: 'Topic preferences configuration',
    type: [TopicPreferenceDto],
    required: false,
  })
  topics?: TopicPreferenceDto[];
}

/**
 * DTO for deleting a specific notification * No body required, notification ID in URL
 * Used with: DELETE /notifications/:notificationId
 */

/**
 * Additional DTOs for enhanced notification operations
 */

/**
 * DTO for batch deleting notifications * Used with: DELETE /users/:userId/notifications
 */
export class BatchDeleteNotificationsDto {
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({
    description: 'IDs of notifications to delete',
    example: ['notification-id-1', 'notification-id-2'],
    type: [String],
  })
  notificationIds: string[];
}

/**
 * DTO for unsubscribing from topics * Used with: DELETE /users/:userId/notifications/subscriptions
 */
export class NotificationUnsubscribeDto {
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({
    description: 'List of topic identifiers to unsubscribe from',
    example: ['transaction-123', 'swap-456'],
    type: [String],
  })
  topics: string[];
}

/**
 * Notification DTO implementing the Notification interface
 */
export class NotificationDto implements Notification {
  userId: string;
  metadata: { [key: string]: string };

  @ApiProperty({
    description: 'Unique notification identifier',
    example: '1234-5678-90ab-cdef',
  })
  id: string;

  @ApiProperty({
    description: 'Title of the notification',
    example: 'Transaction Complete',
  })
  title: string;

  @ApiProperty({
    description: 'Body content of the notification',
    example: 'Your transaction has been confirmed',
  })
  body: string;

  @ApiProperty({
    description: 'Topic this notification belongs to',
    enum: NotificationTopic,
    example: NotificationTopic.TRANSACTION,
  })
  topic: NotificationTopic;

  @ApiProperty({
    description: 'Importance level of the notification',
    example: NotificationImportance.HIGH,
  })
  @IsEnum(NotificationImportance)
  importance: NotificationImportance;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
  })
  read: boolean;

  @ApiProperty({
    description: 'Timestamp when the notification was created',
    example: 1649368800000,
  })
  createdAt: number;
}

/**
 * Response data for get notifications endpoint
 */
export class GetNotificationsResponseData implements GetNotificationsResponse {
  @ApiProperty({
    description: 'List of notifications',
    type: [NotificationDto],
  })
  notifications: Notification[];

  @ApiProperty({
    description: 'Total count of notifications matching the query',
    example: 42,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 0,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  size: number;
}

/**
 * Response DTO for get notifications endpoint
 */
export class GetNotificationsResponseDto {
  @ApiProperty({
    description: 'Success status of the request',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'The returned notification data',
    type: GetNotificationsResponseData,
  })
  @ValidateNested()
  data: GetNotificationsResponseData;
}

/**
 * Response DTO for mark as read endpoint
 */
export class MarkAsReadResponseDto {
  @ApiProperty({
    description: 'Success status of the operation',
    example: true,
  })
  success: boolean;
}

/**
 * Response DTO for update preferences endpoint
 */
export class UpdatePreferencesResponseDto {
  @ApiProperty({
    description: 'Success status of the operation',
    example: true,
  })
  success: boolean;
}

/**
 * Event DTOs for notifications
 */
export class NotificationCreatedEventDto {
  @ApiProperty({
    description: 'Unique notification identifier',
    example: '1234-5678-90ab-cdef',
  })
  id: string;

  @ApiProperty({
    description: 'Title of the notification',
    example: 'Transaction Complete',
  })
  title: string;

  @ApiProperty({
    description: 'Body content of the notification',
    example: 'Your transaction has been confirmed',
  })
  body: string;

  @ApiProperty({
    description: 'Topic this notification belongs to',
    enum: NotificationTopic,
    example: NotificationTopic.TRANSACTION,
  })
  topic: NotificationTopic;

  @ApiProperty({
    description: 'Importance level of the notification',
    example: 'high',
  })
  importance: string;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
  })
  read: boolean;

  @ApiProperty({
    description: 'Timestamp when the notification was created',
    example: 1649368800000,
  })
  createdAt: number;
}

export class NotificationDeliveredEventDto {
  @ApiProperty({
    description: 'Notification ID that was delivered',
    example: '1234-5678-90ab-cdef',
  })
  id: string;

  @ApiProperty({
    description: 'Channel through which the notification was delivered',
    enum: NotificationChannel,
    example: NotificationChannel.SMS,
  })
  channel: NotificationChannel;

  @ApiProperty({
    description: 'Whether delivery was successful',
    example: true,
  })
  success: boolean;
}

export class PreferencesUpdatedEventDto {
  @ApiProperty({
    description: 'Timestamp when preferences were updated',
    example: 1649368800000,
  })
  timestamp: number;
}
