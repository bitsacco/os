import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { SmsController } from './sms.controller';
import { type ClientGrpc } from '@nestjs/microservices';
import { SMS_SERVICE_NAME, SmsServiceClient } from '@bitsacco/common';

describe.skip('SmsController', () => {
  let serviceGenerator: ClientGrpc;
  let smsController: SmsController;
  let smsServiceClient: Partial<SmsServiceClient>;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(smsServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(smsServiceClient),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SmsController],
      providers: [
        {
          provide: SMS_SERVICE_NAME,
          useValue: serviceGenerator,
        },
      ],
    });

    smsController = module.get<SmsController>(SmsController);
  });

  it('should be defined', () => {
    expect(smsController).toBeDefined();
  });
});
