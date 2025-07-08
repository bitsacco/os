import { TestingModule } from '@nestjs/testing';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { SmsController } from './sms.controller';
import { type ClientGrpc } from '@nestjs/microservices';
import {
  SMS_SERVICE_NAME,
  SmsServiceClient,
  CircuitBreakerService,
} from '@bitsacco/common';

describe('SmsController', () => {
  let serviceGenerator: ClientGrpc;
  let smsController: SmsController;
  let smsServiceClient: Partial<SmsServiceClient>;

  beforeEach(async () => {
    smsServiceClient = {};

    serviceGenerator = {
      getService: jest.fn().mockReturnValue(smsServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(smsServiceClient),
    };

    const jwtAuthMocks = provideJwtAuthStrategyMocks();

    // Create a mock for the CircuitBreakerService
    const mockCircuitBreaker = {
      execute: jest.fn().mockImplementation((serviceKey, observable) => {
        return observable;
      }),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SmsController],
      providers: [
        {
          provide: SMS_SERVICE_NAME,
          useValue: serviceGenerator,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreaker,
        },
        ...jwtAuthMocks,
      ],
    });

    smsController = module.get<SmsController>(SmsController);
  });

  it('should be defined', () => {
    expect(smsController).toBeDefined();
  });
});
