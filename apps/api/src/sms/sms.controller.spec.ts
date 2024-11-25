import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';

import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

describe.skip('SmsController', () => {
  let controller: SmsController;
  let smsService: SmsService;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SmsController],
      providers: [
        {
          provide: SmsService,
          useValue: {
            sendSms: jest.fn(),
            sendBulkSms: jest.fn(),
          },
        },
      ],
    });

    controller = module.get<SmsController>(SmsController);
    smsService = module.get<SmsService>(SmsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(smsService).toBeDefined();
  });
});
