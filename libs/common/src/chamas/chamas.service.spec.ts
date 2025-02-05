import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { type ClientGrpc } from '@nestjs/microservices';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { SmsServiceClient } from '../types';
import { ChamasRepository } from './chamas.repository';
import { ChamasService } from './chamas.service';

describe('ChamasService', () => {
  let chamasService: ChamasService;
  let mockChamasRepository: ChamasRepository;
  let serviceGenerator: ClientGrpc;
  let mockSmsServiceClient: Partial<SmsServiceClient>;
  let mockCfg: ConfigService;

  beforeEach(async () => {
    mockChamasRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    } as unknown as ChamasRepository;

    serviceGenerator = {
      getService: jest.fn().mockReturnValue(mockSmsServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(mockSmsServiceClient),
    };

    mockCfg = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    } as unknown as ConfigService;

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [
        {
          provide: ChamasRepository,
          useValue: mockChamasRepository,
        },
        {
          provide: ConfigService,
          useValue: mockCfg,
        },
        {
          provide: ChamasService,
          useFactory: () => {
            return new ChamasService(mockCfg, mockChamasRepository);
          },
        },
      ],
    });

    chamasService = module.get<ChamasService>(ChamasService);
  });

  it('should be defined', () => {
    expect(chamasService).toBeDefined();
  });
});
