import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  GetNotificationsResponse,
  type Notification,
  NotificationChannel,
  NotificationImportance,
  NotificationTopic,
} from '@bitsacco/common';
import { Type } from 'class-transformer';

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

export class GetNotificationsDto {
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
    example: [0, 3],
  })
  topics?: NotificationTopic[];
}

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

class GetNotificationsResponseData implements GetNotificationsResponse {
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

export class GetNotificationsResponseDto {
  @ApiProperty({
    description: 'Success status of the request',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'The returned notification data',
    type: Object,
  })
  @ValidateNested()
  data: GetNotificationsResponseData;
}

export class MarkAsReadDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({
    description:
      'IDs of notifications to mark as read. If empty, marks all notifications as read.',
    example: ['notification-id-1', 'notification-id-2'],
    required: false,
    type: [String],
  })
  notificationIds?: string[];
}

export class MarkAsReadResponseDto {
  @ApiProperty({
    description: 'Success status of the operation',
    example: true,
  })
  success: boolean;
}

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

export class UpdatePreferencesDto {
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

export class UpdatePreferencesResponseDto {
  @ApiProperty({
    description: 'Success status of the operation',
    example: true,
  })
  success: boolean;
}

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
