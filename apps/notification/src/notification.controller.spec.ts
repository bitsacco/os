import { Test, TestingModule } from '@nestjs/testing';
import { NotificationChannel, NotificationTopic } from '@bitsacco/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

const mockNotificationService = {
  getPreferences: jest.fn(),
  updatePreferences: jest.fn(),
  getNotifications: jest.fn(),
  markAsRead: jest.fn(),
  sendNotification: jest.fn(),
};

describe('NotificationController', () => {
  let controller: NotificationController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPreferences', () => {
    it('should call service.getPreferences with the userId', async () => {
      const mockRequest = { userId: 'user123' };
      const mockResponse = {
        userId: 'user123',
        channels: [],
        topics: [],
      };

      mockNotificationService.getPreferences.mockResolvedValue(mockResponse);

      const result = await controller.getPreferences(mockRequest);

      expect(mockNotificationService.getPreferences).toHaveBeenCalledWith(
        'user123',
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updatePreferences', () => {
    it('should call service.updatePreferences with the correct parameters', async () => {
      const mockRequest = {
        userId: 'user123',
        channels: [{ channel: NotificationChannel.SMS, enabled: true }],
        topics: [
          {
            topic: NotificationTopic.TRANSACTION,
            enabled: true,
            channels: [NotificationChannel.SMS],
          },
        ],
      };

      mockNotificationService.updatePreferences.mockResolvedValue({});

      const result = await controller.updatePreferences(mockRequest);

      expect(mockNotificationService.updatePreferences).toHaveBeenCalledWith(
        'user123',
        mockRequest.channels,
        mockRequest.topics,
      );
      expect(result).toEqual({});
    });
  });

  describe('getNotifications', () => {
    it('should call service.getNotifications with the correct parameters', async () => {
      const mockRequest = {
        userId: 'user123',
        unreadOnly: true,
        pagination: { page: 0, size: 10 },
        topics: [NotificationTopic.TRANSACTION],
      };

      const mockResponse = {
        notifications: [],
        total: 0,
        page: 0,
        size: 10,
      };

      mockNotificationService.getNotifications.mockResolvedValue(mockResponse);

      const result = await controller.getNotifications(mockRequest);

      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
        'user123',
        true,
        { page: 0, size: 10 },
        [NotificationTopic.TRANSACTION],
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('markAsRead', () => {
    it('should call service.markAsRead with the correct parameters', async () => {
      const mockRequest = {
        userId: 'user123',
        notificationIds: ['notification1', 'notification2'],
      };

      mockNotificationService.markAsRead.mockResolvedValue({});

      const result = await controller.markAsRead(mockRequest);

      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        'user123',
        ['notification1', 'notification2'],
      );
      expect(result).toEqual({});
    });
  });

  describe('sendNotification', () => {
    it('should call service.sendNotification with the correct parameters', async () => {
      const mockRequest = {
        userId: 'user123',
        title: 'Test Notification',
        body: 'This is a test notification',
        topic: NotificationTopic.TRANSACTION,
        metadata: { key: 'value' },
        importance: 2,
        channels: [NotificationChannel.IN_APP, NotificationChannel.SMS],
      };

      const mockResponse = {
        notificationId: 'notification1',
        deliveredTo: [NotificationChannel.IN_APP, NotificationChannel.SMS],
      };

      mockNotificationService.sendNotification.mockResolvedValue(mockResponse);

      const result = await controller.sendNotification(mockRequest);

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        'user123',
        'Test Notification',
        'This is a test notification',
        NotificationTopic.TRANSACTION,
        { key: 'value' },
        2,
        [NotificationChannel.IN_APP, NotificationChannel.SMS],
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
