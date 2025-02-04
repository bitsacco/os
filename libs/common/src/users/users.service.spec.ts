import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { type ClientGrpc } from '@nestjs/microservices';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { SmsServiceClient } from '../types';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let usersService: UsersService;
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
      providers: [
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
        {
          provide: ConfigService,
          useValue: mockCfg,
        },
        {
          provide: UsersService,
          useFactory: () => {
            return new UsersService(mockCfg, mockUsersRepository);
          },
        },
      ],
    });

    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(usersService).toBeDefined();
  });
});
