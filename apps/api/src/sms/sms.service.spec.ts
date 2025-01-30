import { TestingModule } from '@nestjs/testing';
import { SmsServiceClient } from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { type ClientGrpc } from '@nestjs/microservices';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  let service: SmsService;
  let serviceGenerator: ClientGrpc;
  let mockSmsServiceClient: Partial<SmsServiceClient>;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(mockSmsServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(mockSmsServiceClient),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [
        {
          provide: SmsService,
          useFactory: () => {
            return new SmsService(serviceGenerator);
          },
        },
      ],
    });

    service = module.get<SmsService>(SmsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
