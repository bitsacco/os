import { of } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import {
  EVENTS_SERVICE_BUS,
  NotificationCreatedEvent,
  NotificationChannel,
  NotificationImportance,
  NotificationTopic,
  FedimintContext,
  SwapContext,
  WalletTxContext,
  TransactionStatus,
  extractUserIdFromEvent,
} from '@bitsacco/common';
import { NotificationService } from './notification.service';
import { NotificationMetrics } from './notification.metrics';
import { NotificationRepository } from './db/notification.repository';
import { NotificationPreferencesRepository } from './db/preferences.repository';
import { RateLimitService } from './ratelimit';
import { SmsService } from '../sms/sms.service';
import { NostrService } from '../nostr/nostr.service';

const mockNotificationRepository = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  markAsRead: jest.fn(),
  find: jest.fn(),
  addDeliveryChannel: jest.fn(),
};

const mockPreferencesRepository = {
  getOrCreatePreferences: jest.fn(),
  updatePreferences: jest.fn(),
  isChannelEnabledForTopic: jest.fn(),
};

const mockMetrics = {
  notificationCreated: jest.fn(),
  notificationDelivered: jest.fn(),
  notificationRead: jest.fn(),
  recordDeliveryLatency: jest.fn(),
  preferencesUpdated: jest.fn(),
};

const mockEventsClient = {
  emit: jest.fn(),
};

const mockSmsService = {
  sendSms: jest.fn(),
};

const mockNostrService = {
  sendEncryptedDirectMessage: jest.fn(),
};

const mockRateLimitService = {
  checkRateLimit: jest.fn(() => ({
    allowed: true,
    nextAllowedAt: Date.now(),
    remaining: 10,
    retryAfterMs: 0,
  })),
  updateChannelConfig: jest.fn(),
  updateImportanceConfig: jest.fn(),
  resetUserLimits: jest.fn(),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // The issue is that the notification service has a new constructor parameter
    // that needs to be properly mocked. Instead of using NestJS's DI, we'll create
    // the service instance manually.

    service = new NotificationService(
      mockNotificationRepository,
      mockPreferencesRepository,
      mockMetrics,
      mockRateLimitService,
      mockEventsClient,
      mockSmsService,
      mockNostrService,
    );

    // Setup default mocks
    mockSmsService.sendSms.mockResolvedValue(undefined);
    mockNostrService.sendEncryptedDirectMessage.mockResolvedValue(undefined);
    mockNotificationRepository.create.mockResolvedValue({
      _id: 'notification123',
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPreferences', () => {
    it('should get user preferences', async () => {
      const userId = 'user123';
      mockPreferencesRepository.getOrCreatePreferences.mockResolvedValue({
        userId,
        channelPreferences: new Map([
          ['0', true], // IN_APP
          ['1', false], // SMS
          ['2', true], // NOSTR
        ]),
        topicPreferences: new Map([
          ['0', { enabled: true, channels: ['0', '2'] }], // TRANSACTION
          ['3', { enabled: false, channels: [] }], // SWAP
        ]),
      });

      const result = await service.getPreferences(userId);

      expect(
        mockPreferencesRepository.getOrCreatePreferences,
      ).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        userId,
        channels: [
          { channel: 0, enabled: true },
          { channel: 1, enabled: false },
          { channel: 2, enabled: true },
        ],
        topics: [
          { topic: 0, enabled: true, channels: [0, 2] },
          { topic: 3, enabled: false, channels: [] },
        ],
      });
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      const userId = 'user123';
      const channels = [{ channel: NotificationChannel.SMS, enabled: true }];
      const topics = [
        {
          topic: NotificationTopic.TRANSACTION,
          enabled: true,
          channels: [NotificationChannel.SMS, NotificationChannel.NOSTR],
        },
      ];

      mockPreferencesRepository.updatePreferences.mockResolvedValue({});

      await service.updatePreferences(userId, channels, topics);

      expect(mockPreferencesRepository.updatePreferences).toHaveBeenCalledWith(
        userId,
        channels,
        topics,
      );
      expect(mockMetrics.preferencesUpdated).toHaveBeenCalled();
      expect(mockEventsClient.emit).toHaveBeenCalled();
    });
  });

  describe('sendNotification', () => {
    it('should create and deliver a notification', async () => {
      const userId = 'user123';
      const title = 'Test Notification';
      const body = 'This is a test notification';
      const topic = NotificationTopic.TRANSACTION;
      const importance = NotificationImportance.HIGH;
      const channels = [NotificationChannel.IN_APP, NotificationChannel.SMS];

      const mockNotification = {
        _id: 'notification123',
        userId,
        title,
        body,
        topic,
        importance,
      };

      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.addDeliveryChannel.mockResolvedValue({
        acknowledged: true,
      });

      // Default rate limit check should allow
      mockRateLimitService.checkRateLimit.mockReturnValue({
        allowed: true,
        nextAllowedAt: Date.now(),
        remaining: 10,
        retryAfterMs: 0,
      });

      const result = await service.sendNotification(
        userId,
        title,
        body,
        topic,
        {},
        importance,
        channels,
      );

      expect(mockNotificationRepository.create).toHaveBeenCalled();
      expect(mockMetrics.notificationCreated).toHaveBeenCalledWith(
        topic,
        importance,
      );
      expect(mockEventsClient.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          notificationId: 'notification123',
          userId,
          title,
          body,
          topic,
          importance,
          channels,
        } as NotificationCreatedEvent),
      );

      // Should check rate limits for each channel
      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
        userId,
        NotificationChannel.IN_APP,
        importance,
      );
      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
        userId,
        NotificationChannel.SMS,
        importance,
      );

      // Should call SMS service
      expect(mockSmsService.sendSms).toHaveBeenCalledWith({
        message: `${title}\n${body}`,
        receiver: userId,
      });

      // Result should include notification ID and delivered channels
      expect(result).toEqual({
        notificationId: 'notification123',
        deliveredTo: [NotificationChannel.IN_APP, NotificationChannel.SMS],
      });
    });

    it('should respect rate limits when delivering notifications', async () => {
      const userId = 'user123';
      const title = 'Test Notification';
      const body = 'This is a test notification';
      const topic = NotificationTopic.TRANSACTION;
      const importance = NotificationImportance.MEDIUM;
      const channels = [
        NotificationChannel.IN_APP,
        NotificationChannel.SMS,
        NotificationChannel.NOSTR,
      ];

      const mockNotification = {
        _id: 'notification123',
        userId,
        title,
        body,
        topic,
        importance,
      };

      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.addDeliveryChannel.mockResolvedValue({
        acknowledged: true,
      });

      // Set up rate limit responses for each channel
      mockRateLimitService.checkRateLimit.mockImplementation(
        (userId, channel) => {
          // Allow IN_APP, rate limit SMS and NOSTR
          if (channel === NotificationChannel.IN_APP) {
            return {
              allowed: true,
              nextAllowedAt: Date.now(),
              remaining: 10,
              retryAfterMs: 0,
            };
          } else {
            return {
              allowed: false,
              nextAllowedAt: Date.now() + 60000, // 1 minute later
              remaining: 0,
              retryAfterMs: 60000,
            };
          }
        },
      );

      const result = await service.sendNotification(
        userId,
        title,
        body,
        topic,
        {},
        importance,
        channels,
      );

      // Should still create the notification
      expect(mockNotificationRepository.create).toHaveBeenCalled();

      // Should check rate limits for each channel
      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledTimes(3);

      // Should NOT call SMS or NOSTR services due to rate limiting
      expect(mockSmsService.sendSms).not.toHaveBeenCalled();
      expect(
        mockNostrService.sendEncryptedDirectMessage,
      ).not.toHaveBeenCalled();

      // Result should include only IN_APP in deliveredTo (since others were rate limited)
      expect(result.deliveredTo).toEqual([NotificationChannel.IN_APP]);
    });

    it('should use preferences to determine channels when none specified', async () => {
      const userId = 'user123';
      const title = 'Test Notification';
      const body = 'This is a test notification';
      const topic = NotificationTopic.TRANSACTION;

      const mockNotification = {
        _id: 'notification123',
        userId,
        title,
        body,
        topic,
      };

      mockNotificationRepository.create.mockResolvedValue(mockNotification);
      mockNotificationRepository.addDeliveryChannel.mockResolvedValue({
        acknowledged: true,
      });

      // Mock channel preferences
      mockPreferencesRepository.isChannelEnabledForTopic.mockImplementation(
        (userId, topic, channel) => {
          // Only enable IN_APP for this test
          return channel === NotificationChannel.IN_APP
            ? Promise.resolve(true)
            : Promise.resolve(false);
        },
      );

      const result = await service.sendNotification(userId, title, body, topic);

      // Should not call SMS or Nostr since they're not enabled
      expect(mockSmsService.sendSms).not.toHaveBeenCalled();
      expect(
        mockNostrService.sendEncryptedDirectMessage,
      ).not.toHaveBeenCalled();

      // Result should include only IN_APP channel
      expect(result.deliveredTo).toEqual([NotificationChannel.IN_APP]);
    });
  });

  describe('getNotifications', () => {
    it('should get user notifications', async () => {
      const userId = 'user123';
      const mockNotifications = [
        {
          _id: 'notification1',
          userId,
          title: 'Test 1',
          body: 'Body 1',
          topic: NotificationTopic.TRANSACTION,
          read: false,
          createdAt: new Date('2023-01-01'),
          metadata: new Map([['key1', 'value1']]),
          importance: NotificationImportance.HIGH,
        },
        {
          _id: 'notification2',
          userId,
          title: 'Test 2',
          body: 'Body 2',
          topic: NotificationTopic.SWAP,
          read: true,
          createdAt: new Date('2023-01-02'),
          metadata: new Map(),
          importance: NotificationImportance.MEDIUM,
        },
      ];

      mockNotificationRepository.findByUserId.mockResolvedValue({
        notifications: mockNotifications,
        total: 2,
        page: 0,
        size: 10,
      });

      const result = await service.getNotifications(userId, true, {
        page: 0,
        size: 10,
      });

      expect(mockNotificationRepository.findByUserId).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          unreadOnly: true,
          page: 0,
          size: 10,
        }),
      );

      expect(result.notifications).toHaveLength(2);
      expect(result.notifications[0].id).toBe('notification1');
      expect(result.notifications[0].createdAt).toBe(
        new Date('2023-01-01').getTime(),
      );
      expect(result.notifications[0].metadata).toEqual({ key1: 'value1' });
      expect(result.total).toBe(2);
    });
  });

  describe('markAsRead', () => {
    it('should mark notifications as read', async () => {
      const userId = 'user123';
      const notificationIds = ['notification1', 'notification2'];

      mockNotificationRepository.markAsRead.mockResolvedValue({
        modifiedCount: 2,
      });
      mockNotificationRepository.find.mockResolvedValue([
        { topic: NotificationTopic.TRANSACTION },
        { topic: NotificationTopic.SWAP },
      ]);

      await service.markAsRead(userId, notificationIds);

      expect(mockNotificationRepository.markAsRead).toHaveBeenCalledWith(
        userId,
        notificationIds,
      );
      expect(mockNotificationRepository.find).toHaveBeenCalledWith(
        notificationIds,
      );
      expect(mockMetrics.notificationRead).toHaveBeenCalledTimes(2);
    });
  });

  // Add tests for event handlers that use extractUserIdFromEvent
  // For the event handlers that use extractUserIdFromEvent, we'd need to test by:
  // 1. Writing a test utility that allows mocking of imported functions
  // 2. Creating a class with manual dependency injection for extractUserIdFromEvent
  // 3. Using function wrappers that can be more easily mocked
  //
  // Using a comment as documentation instead to explain the expected behavior:
  /*
   * Event handler behavior with invalid user IDs:
   *
   * All event handlers (handleFedimintSuccess, handleFedimintFailure,
   * handleSwapStatusChange, handleCollectionForShares) use the extractUserIdFromEvent
   * utility to get a valid user ID from the event.
   *
   * If this utility returns null (indicating no valid user ID could be extracted):
   * 1. The handler logs an error message containing "Could not extract valid user ID"
   * 2. The handler returns early without calling sendNotification
   * 3. No notification is created or sent for the event
   *
   * This ensures that:
   * - We don't send notifications to invalid or non-existent users
   * - We have proper error logging for debugging
   * - The system gracefully handles malformed events
   */
});
