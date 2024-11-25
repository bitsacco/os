import { TestingModule } from '@nestjs/testing';
import { SharesServiceClient } from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ClientGrpc } from '@nestjs/microservices';
import { SharesService } from './shares.service';

describe('SharesService', () => {
  let service: SharesService;
  let serviceGenerator: ClientGrpc;
  let mockSharesServiceClient: Partial<SharesServiceClient>;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(mockSharesServiceClient),
      getClientByServiceName: jest
        .fn()
        .mockReturnValue(mockSharesServiceClient),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [
        {
          provide: SharesService,
          useFactory: () => {
            return new SharesService(serviceGenerator);
          },
        },
      ],
    });

    service = module.get<SharesService>(SharesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
