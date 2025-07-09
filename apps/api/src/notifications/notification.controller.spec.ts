import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationChannel,
  NotificationTopic,
  JwtAuthGuard,
  UsersDocument,
} from '@bitsacco/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

const mockNotificationService = {
  getPreferences: jest.fn().mockResolvedValue({
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
  updatePreferences: jest.fn().mockResolvedValue(undefined),
  getNotifications: jest.fn().mockResolvedValue({
    notifications: [],
    total: 0,
    page: 0,
    size: 10,
  }),
  markAsRead: jest.fn().mockResolvedValue(undefined),
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
          provide: NotificationService,
          useValue: mockNotificationService,
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

      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
        'user123',
        true,
        { page: 0, size: 10 },
        [NotificationTopic.TRANSACTION],
      );

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

      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
        'user123',
        false,
        { page: 0, size: 10 },
        [],
      );

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

      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        'user123',
        ['notification1', 'notification2'],
      );

      expect(result).toEqual({ success: true });
    });

    it('should mark all notifications as read when no IDs are provided', async () => {
      const result = await controller.markAsRead(mockUser, {
        notificationIds: [],
      });

      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        'user123',
        [],
      );

      expect(result).toEqual({ success: true });
    });
  });

  describe('getPreferences', () => {
    it('should call service.getPreferences with correct userId', async () => {
      const result = await controller.getPreferences(mockUser);

      expect(mockNotificationService.getPreferences).toHaveBeenCalledWith(
        'user123',
      );

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

      expect(mockNotificationService.updatePreferences).toHaveBeenCalledWith(
        'user123',
        preferenceData.channels,
        preferenceData.topics,
      );

      expect(result).toEqual({ success: true });
    });

    it('should handle empty arrays correctly', async () => {
      const result = await controller.updatePreferences(mockUser, {});

      expect(mockNotificationService.updatePreferences).toHaveBeenCalledWith(
        'user123',
        [],
        [],
      );

      expect(result).toEqual({ success: true });
    });
  });
});
