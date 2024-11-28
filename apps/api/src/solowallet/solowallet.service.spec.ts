import { TestingModule } from '@nestjs/testing';
import { ClientGrpc } from '@nestjs/microservices';
import { SolowalletServiceClient } from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { SolowalletService } from './solowallet.service';

describe('SolowalletService', () => {
  let service: SolowalletService;
  let serviceGenerator: ClientGrpc;
  let mockSolowalletServiceClient: Partial<SolowalletServiceClient>;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(mockSolowalletServiceClient),
      getClientByServiceName: jest
        .fn()
        .mockReturnValue(mockSolowalletServiceClient),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [{
        provide: SolowalletService,
        useFactory: () => {
          return new SolowalletService(serviceGenerator);
        }
      }],
    });

    service = module.get<SolowalletService>(SolowalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
