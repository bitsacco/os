import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { UsersController } from './users.controller';
import {
  UsersService,
  UsersRepository,
  SmsServiceClient,
} from '@bitsacco/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;
  let mockUsersRepository: UsersRepository;
  let serviceGenerator: ClientGrpc;
  let mockSmsServiceClient: Partial<SmsServiceClient>;
  let mockCfg: ConfigService;

  beforeEach(async () => {
    mockUsersRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    } as unknown as UsersRepository;

    serviceGenerator = {
      getService: jest.fn().mockReturnValue(mockSmsServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(mockSmsServiceClient),
    };

    mockCfg = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    } as unknown as ConfigService;

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useFactory: () => {
            return new UsersService(mockCfg, mockUsersRepository);
          },
        },
      ],
    });

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
