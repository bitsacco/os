import { of } from 'rxjs';
import { Socket, Server } from 'socket.io';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EVENTS_SERVICE_BUS,
  NOTIFICATION_SERVICE_NAME,
  NotificationCreatedEvent,
  NotificationTopic,
  NotificationImportance,
  NotificationChannel,
} from '@bitsacco/common';
import { NotificationGateway } from './notification.gateway';

// Create a mock Socket
const mockSocket = {
  id: 'test-socket-id',
  handshake: {
    auth: {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJpYXQiOjE1MTYyMzkwMjJ9.4pcPyMD3gOc-Gw-bvsz4-QRUzxGNgimKE-RWsLor5Fg',
    },
    headers: {},
  },
  join: jest.fn(),
  leave: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
} as unknown as Socket;

// Mock server implementation
const mockServer = {
  sockets: {
    sockets: new Map([['test-socket-id', mockSocket]]),
  },
  to: jest.fn().mockReturnValue({
    emit: jest.fn(),
  }),
} as unknown as Server;

// Mock Redis event bus client
const mockEventsClient = {
  emit: jest.fn(),
};

// Mock Notification service client
const mockNotificationClient = {
  send: jest.fn(),
};

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationGateway,
        {
          provide: EVENTS_SERVICE_BUS,
          useValue: mockEventsClient,
        },
        {
          provide: NOTIFICATION_SERVICE_NAME,
          useValue: mockNotificationClient,
        },
      ],
    }).compile();

    gateway = module.get<NotificationGateway>(NotificationGateway);

    // Mock WebSocketServer
    gateway.server = mockServer;

    // Set up default mock responses
    mockNotificationClient.send.mockReturnValue(of({}));
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should register a user socket when connected with valid token', () => {
      // Spy on private method
      const registerSpy = jest.spyOn(gateway as any, 'registerUserSocket');

      gateway.handleConnection(mockSocket);

      expect(registerSpy).toHaveBeenCalledWith(
        'test-user-id',
        'test-socket-id',
      );
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'connection:established',
        expect.objectContaining({
          status: 'connected',
          userId: 'test-user-id',
        }),
      );
    });

    it('should disconnect socket when token is invalid', () => {
      const invalidSocket = {
        ...mockSocket,
        handshake: { auth: {}, headers: {} },
      } as unknown as Socket;

      gateway.handleConnection(invalidSocket);

      expect(invalidSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleSubscribe', () => {
    it('should join the client to topic rooms', () => {
      const data = { topics: ['topic1', 'topic2'] };

      const result = gateway.handleSubscribe(mockSocket, data);

      expect(mockSocket.join).toHaveBeenCalledTimes(2);
      expect(mockSocket.join).toHaveBeenCalledWith('topic1');
      expect(mockSocket.join).toHaveBeenCalledWith('topic2');
      expect(result).toEqual({
        event: 'subscribe',
        data: { success: true, topics: ['topic1', 'topic2'] },
      });
    });

    it('should handle invalid topic input', () => {
      const result = gateway.handleSubscribe(mockSocket, null);

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(result).toEqual({
        event: 'subscribe',
        data: { success: false, topics: [] },
      });
    });
  });

  describe('handleGetNotifications', () => {
    it('should call the notification service to get notifications', async () => {
      const mockResponse = {
        notifications: [{ id: 'notification1', title: 'Test Notification' }],
        total: 1,
        page: 0,
        size: 10,
      };

      mockNotificationClient.send.mockReturnValueOnce(of(mockResponse));

      const result = await gateway.handleGetNotifications(mockSocket, {
        unreadOnly: true,
        page: 0,
        size: 10,
      });

      expect(mockNotificationClient.send).toHaveBeenCalledWith(
        'GetNotifications',
        {
          userId: 'test-user-id',
          unreadOnly: true,
          pagination: { page: 0, size: 10 },
          topics: [],
        },
      );

      expect(result).toEqual({
        event: 'getNotifications',
        data: {
          success: true,
          data: mockResponse,
        },
      });
    });
  });

  describe('internal event handlers', () => {
    it('should handle notification created events and emit to users', () => {
      const emitSpy = jest.spyOn(gateway as any, 'emitToUser');

      const payload: NotificationCreatedEvent = {
        notificationId: 'test-notification',
        userId: 'test-user-id',
        title: 'Test Notification',
        body: 'This is a test notification',
        topic: NotificationTopic.TRANSACTION,
        importance: NotificationImportance.HIGH,
        channels: [NotificationChannel.IN_APP],
      };

      // Call the private method directly for testing
      (gateway as any).handleNotificationCreated(payload);

      expect(emitSpy).toHaveBeenCalledWith(
        'test-user-id',
        'notification:created',
        expect.objectContaining({
          id: 'test-notification',
          title: 'Test Notification',
        }),
      );

      expect(mockServer.to).toHaveBeenCalledWith(
        `topic:${NotificationTopic.TRANSACTION}`,
      );
    });
  });
});
