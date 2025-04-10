import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ChannelPreference,
  NotificationChannel,
  NotificationImportance,
  NotificationTopic,
  PaginatedRequestDto,
  TopicPreference,
} from '@bitsacco/common';

export class ChannelPreferenceDto implements ChannelPreference {
  @IsEnum(NotificationChannel)
  @ApiProperty({
    enum: NotificationChannel,
    description: 'Notification channel (0=IN_APP, 1=SMS, 2=NOSTR)',
  })
  channel: NotificationChannel;

  @IsBoolean()
  @ApiProperty({ description: 'Whether the channel is enabled' })
  enabled: boolean;
}

export class TopicPreferenceDto implements TopicPreference {
  @IsEnum(NotificationTopic)
  @ApiProperty({
    enum: NotificationTopic,
    description:
      'Notification topic (0=TRANSACTION, 1=SECURITY, 2=SYSTEM, 3=SWAP, 4=SHARES, 5=CHAMA)',
  })
  topic: NotificationTopic;

  @IsBoolean()
  @ApiProperty({ description: 'Whether the topic is enabled' })
  enabled: boolean;

  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  @ApiProperty({
    type: [Number],
    enum: NotificationChannel,
    description: 'Channels enabled for this topic',
  })
  channels: NotificationChannel[];
}

export class NotificationDto {
  @IsString()
  @ApiProperty({ description: 'Notification ID' })
  id: string;

  @IsString()
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @IsString()
  @ApiProperty({ description: 'Notification title' })
  title: string;

  @IsString()
  @ApiProperty({ description: 'Notification body' })
  body: string;

  @IsEnum(NotificationTopic)
  @ApiProperty({
    enum: NotificationTopic,
    description: 'Notification topic',
  })
  topic: NotificationTopic;

  @IsBoolean()
  @ApiProperty({ description: 'Whether the notification has been read' })
  read: boolean;

  @IsNumber()
  @ApiProperty({ description: 'Timestamp when the notification was created' })
  createdAt: number;

  @ApiProperty({ description: 'Additional metadata', type: Object })
  metadata: Record<string, string>;

  @IsEnum(NotificationImportance)
  @ApiProperty({
    enum: NotificationImportance,
    description: 'Notification importance',
  })
  importance: NotificationImportance;
}

export class GetNotificationsResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationDto)
  @ApiProperty({ type: [NotificationDto] })
  notifications: NotificationDto[];

  @IsNumber()
  @ApiProperty({ description: 'Total number of notifications' })
  total: number;

  @IsNumber()
  @ApiProperty({ description: 'Current page number' })
  page: number;

  @IsNumber()
  @ApiProperty({ description: 'Page size' })
  size: number;
}

export class GetNotificationsQueryDto extends PaginatedRequestDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  @ApiProperty({ required: false, description: 'Filter unread notifications' })
  unreadOnly?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationTopic, { each: true })
  @ApiProperty({
    required: false,
    enum: NotificationTopic,
    isArray: true,
    description: 'Filter by topics',
  })
  topics?: NotificationTopic[];
}

export class MarkNotificationsAsReadDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ApiProperty({
    description:
      'IDs of notifications to mark as read. If empty, all notifications are marked as read.',
    required: false,
    type: [String],
  })
  notificationIds: string[] = [];
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelPreferenceDto)
  @ApiProperty({
    type: [ChannelPreferenceDto],
    required: false,
    description: 'Channel preferences',
  })
  channels?: ChannelPreferenceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopicPreferenceDto)
  @ApiProperty({
    type: [TopicPreferenceDto],
    required: false,
    description: 'Topic preferences',
  })
  topics?: TopicPreferenceDto[];
}
