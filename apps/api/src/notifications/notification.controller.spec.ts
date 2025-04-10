import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { of } from 'rxjs';
import {
  NotificationChannel,
  NotificationTopic,
  NOTIFICATION_SERVICE_NAME,
  JwtAuthGuard,
  UsersDocument,
} from '@bitsacco/common';
import { NotificationController } from './notification.controller';

const mockNotificationService = {
  getPreferences: jest.fn().mockReturnValue(
    of({
      userId: 'user123',
      channels: [{ channel: NotificationChannel.IN_APP, enabled: true }],
      topics: [
        {
          topic: NotificationTopic.TRANSACTION,
          enabled: true,
          channels: [NotificationChannel.IN_APP],
        },
      ],
    }),
  ),
  updatePreferences: jest.fn().mockReturnValue(of({})),
  getNotifications: jest.fn().mockReturnValue(
    of({
      notifications: [],
      total: 0,
      page: 0,
      size: 10,
    }),
  ),
  markAsRead: jest.fn().mockReturnValue(of({})),
};

const mockGrpcClient = {
  getService: jest.fn().mockReturnValue(mockNotificationService),
};

const mockUser: UsersDocument = {
  _id: 'user123',
  phone: {
    number: '',
    verified: true,
  },
  roles: [0, 1],
  pinHash: 'somePinHash',
  otp: '123456',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('NotificationController', () => {
  let controller: NotificationController;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create a mock JwtAuthGuard
    const mockJwtAuthGuard = {
      canActivate: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [NotificationController],
      providers: [
        {
          provide: NOTIFICATION_SERVICE_NAME,
          useValue: mockGrpcClient,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<NotificationController>(NotificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNotifications', () => {
    it('should call service.getNotifications with correct parameters', async () => {
      const result = await controller.getNotifications(
        mockUser,
        'true',
        0,
        10,
        [NotificationTopic.TRANSACTION],
      );

      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith({
        userId: 'user123',
        unreadOnly: true,
        pagination: { page: 0, size: 10 },
        topics: [NotificationTopic.TRANSACTION],
      });

      expect(result).toEqual({
        success: true,
        data: {
          notifications: [],
          total: 0,
          page: 0,
          size: 10,
        },
      });
    });

    it('should handle default parameters correctly', async () => {
      const result = await controller.getNotifications(mockUser);

      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith({
        userId: 'user123',
        unreadOnly: false,
        pagination: { page: 0, size: 10 },
        topics: [],
      });

      expect(result).toEqual({
        success: true,
        data: {
          notifications: [],
          total: 0,
          page: 0,
          size: 10,
        },
      });
    });
  });

  describe('markAsRead', () => {
    it('should call service.markAsRead with correct parameters', async () => {
      const result = await controller.markAsRead(mockUser, {
        notificationIds: ['notification1', 'notification2'],
      });

      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith({
        userId: 'user123',
        notificationIds: ['notification1', 'notification2'],
      });

      expect(result).toEqual({ success: true });
    });

    it('should mark all notifications as read when no IDs are provided', async () => {
      const result = await controller.markAsRead(mockUser, {
        notificationIds: [],
      });

      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith({
        userId: 'user123',
        notificationIds: [],
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe('getPreferences', () => {
    it('should call service.getPreferences with correct userId', async () => {
      const result = await controller.getPreferences(mockUser);

      expect(mockNotificationService.getPreferences).toHaveBeenCalledWith({
        userId: 'user123',
      });

      expect(result).toEqual({
        userId: 'user123',
        channels: [{ channel: NotificationChannel.IN_APP, enabled: true }],
        topics: [
          {
            topic: NotificationTopic.TRANSACTION,
            enabled: true,
            channels: [NotificationChannel.IN_APP],
          },
        ],
      });
    });
  });

  describe('updatePreferences', () => {
    it('should call service.updatePreferences with correct parameters', async () => {
      const preferenceData = {
        channels: [
          { channel: NotificationChannel.IN_APP, enabled: true },
          { channel: NotificationChannel.SMS, enabled: false },
        ],
        topics: [
          {
            topic: NotificationTopic.TRANSACTION,
            enabled: true,
            channels: [NotificationChannel.IN_APP],
          },
        ],
      };

      const result = await controller.updatePreferences(
        mockUser,
        preferenceData,
      );

      expect(mockNotificationService.updatePreferences).toHaveBeenCalledWith({
        userId: 'user123',
        channels: preferenceData.channels,
        topics: preferenceData.topics,
      });

      expect(result).toEqual({ success: true });
    });

    it('should handle empty arrays correctly', async () => {
      const result = await controller.updatePreferences(mockUser, {});

      expect(mockNotificationService.updatePreferences).toHaveBeenCalledWith({
        userId: 'user123',
        channels: [],
        topics: [],
      });

      expect(result).toEqual({ success: true });
    });
  });
});
