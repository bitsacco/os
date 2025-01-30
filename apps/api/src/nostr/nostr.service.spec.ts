import { TestingModule } from '@nestjs/testing';
import { NostrServiceClient } from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { type ClientGrpc } from '@nestjs/microservices';
import { NostrService } from './nostr.service';

describe('NostrService', () => {
  let service: NostrService;
  let serviceGenerator: ClientGrpc;
  let mockNostrServiceClient: Partial<NostrServiceClient>;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(mockNostrServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(mockNostrServiceClient),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [
        {
          provide: NostrService,
          useFactory: () => {
            return new NostrService(serviceGenerator);
          },
        },
      ],
    });

    service = module.get<NostrService>(NostrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
