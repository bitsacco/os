import { Test, TestingModule } from '@nestjs/testing';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

describe('SmsController', () => {
  let smsController: SmsController;
  let smsService: SmsService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
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
    }).compile();

    smsController = app.get<SmsController>(SmsController);
    smsService = app.get<SmsService>(SmsService);
  });

  it('should be defined', () => {
    expect(smsController).toBeDefined();
  });
});
