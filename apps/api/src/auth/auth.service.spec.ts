import { TestingModule } from '@nestjs/testing';
import { AuthServiceClient } from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ClientGrpc } from '@nestjs/microservices';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let serviceGenerator: ClientGrpc;
  let mockAuthServiceClient: Partial<AuthServiceClient>;

  beforeEach(async () => {
    serviceGenerator = {
      getService: jest.fn().mockReturnValue(mockAuthServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(mockAuthServiceClient),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [
        {
          provide: AuthService,
          useFactory: () => {
            return new AuthService(serviceGenerator);
          },
        },
      ],
    });
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
