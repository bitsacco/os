import { TestingModule } from '@nestjs/testing';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { SmsMetricsService } from './sms.metrics';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('SmsController', () => {
  let smsController: SmsController;
  let smsService: SmsService;

  beforeEach(async () => {
    const jwtAuthMocks = provideJwtAuthStrategyMocks();

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

    const module: TestingModule = await createTestingModuleWithValidation({
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
    });

    smsController = module.get<SmsController>(SmsController);
    smsService = module.get<SmsService>(SmsService);
  });

  it('should be defined', () => {
    expect(smsController).toBeDefined();
  });
});
