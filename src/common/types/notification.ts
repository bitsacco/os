import { PaginatedRequest } from './lib';

/** Notification Types and Channels */
export enum NotificationChannel {
  IN_APP = 0,
  SMS = 1,
  NOSTR = 2,
  UNRECOGNIZED = -1,
}

export enum NotificationImportance {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3,
  UNRECOGNIZED = -1,
}

export enum NotificationTopic {
  TRANSACTION = 0,
  SECURITY = 1,
  SYSTEM = 2,
  SWAP = 3,
  SHARES = 4,
  CHAMA = 5,
  UNRECOGNIZED = -1,
}

/** Subscription Management */
export interface GetPreferencesRequest {
  userId: string;
}

export interface ChannelPreference {
  channel: NotificationChannel;
  enabled: boolean;
}

export interface TopicPreference {
  topic: NotificationTopic;
  enabled: boolean;
  channels: NotificationChannel[];
}

export interface GetPreferencesResponse {
  userId: string;
  channels: ChannelPreference[];
  topics: TopicPreference[];
}

export interface UpdatePreferencesRequest {
  userId: string;
  channels: ChannelPreference[];
  topics: TopicPreference[];
}

/** Notification CRUD */
export interface GetNotificationsRequest {
  userId: string;
  unreadOnly: boolean;
  pagination: PaginatedRequest | undefined;
  topics: NotificationTopic[];
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  topic: NotificationTopic;
  read: boolean;
  createdAt: number;
  metadata: { [key: string]: string };
  importance: NotificationImportance;
}

export interface Notification_MetadataEntry {
  key: string;
  value: string;
}

export interface GetNotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  size: number;
}

export interface MarkAsReadRequest {
  userId: string;
  /** Empty means mark all as read */
  notificationIds: string[];
}

/** Delivery */
export interface SendNotificationRequest {
  userId: string;
  title: string;
  body: string;
  topic: NotificationTopic;
  metadata: { [key: string]: string };
  importance: NotificationImportance;
  /** Empty means use user preferences */
  channels: NotificationChannel[];
}

export interface SendNotificationRequest_MetadataEntry {
  key: string;
  value: string;
}

export interface SendNotificationResponse {
  notificationId: string;
  deliveredTo: NotificationChannel[];
}
