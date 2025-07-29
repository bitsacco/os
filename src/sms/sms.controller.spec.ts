import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, JwtAuthStrategy } from '../common/auth/jwt.auth';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { SmsMetricsService } from './sms.metrics';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('SmsController', () => {
  let smsController: SmsController;
  let smsService: SmsService;

  beforeEach(async () => {
    const jwtAuthMocks = [
      {
        provide: JwtService,
        useValue: {
          sign: jest.fn(),
          verify: jest.fn(),
          decode: jest.fn(),
        },
      },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn(),
          getOrThrow: jest.fn(),
        },
      },
      {
        provide: Reflector,
        useValue: {
          get: jest.fn(),
          getAllAndOverride: jest.fn(),
        },
      },
      {
        provide: JwtAuthStrategy,
        useValue: {
          validate: jest.fn(),
        },
      },
      {
        provide: JwtAuthGuard,
        useValue: {
          canActivate: jest.fn().mockReturnValue(true),
        },
      },
    ];

    // Create mocks for the services
    const mockSmsService = {
      sendSms: jest.fn().mockResolvedValue({
        id: 'test-id',
        status: 'sent',
        message: 'Test message',
        timestamp: new Date(),
      }),
      sendBulkSms: jest.fn().mockResolvedValue(undefined),
      getSmsStatus: jest.fn().mockResolvedValue({
        id: 'test-id',
        status: 'delivered',
        message: 'Status check not available',
        timestamp: new Date(),
        deliveredAt: new Date(),
      }),
    };

    const mockSmsMetricsService = {
      recordSmsMetric: jest.fn(),
      recordSmsBulkMetric: jest.fn(),
    };

    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('test-value'),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SmsController],
      providers: [
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
        {
          provide: SmsMetricsService,
          useValue: mockSmsMetricsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        ...jwtAuthMocks,
      ],
    }).compile();

    smsController = module.get<SmsController>(SmsController);
    smsService = module.get<SmsService>(SmsService);
  });

  it('should be defined', () => {
    expect(smsController).toBeDefined();
  });
});
