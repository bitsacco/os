import { TestingModule } from '@nestjs/testing';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { SmsController } from './sms.controller';
import { type ClientGrpc } from '@nestjs/microservices';
import { SMS_SERVICE_NAME, SmsServiceClient } from '@bitsacco/common';

describe('SmsController', () => {
  let serviceGenerator: ClientGrpc;
  let smsController: SmsController;
  let smsServiceClient: Partial<SmsServiceClient>;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(smsServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(smsServiceClient),
    };

    const jwtAuthMocks = provideJwtAuthStrategyMocks();

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SmsController],
      providers: [
        {
          provide: SMS_SERVICE_NAME,
          useValue: serviceGenerator,
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
