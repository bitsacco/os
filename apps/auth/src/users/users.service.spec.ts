import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { ConfigService } from '@nestjs/config';

describe('UsersService', () => {
  let usersService: UsersService;
  let mockUsersRepository: UsersRepository;
  let mockCfg: {
    get: jest.Mock;
    getOrThrow: jest.Mock;
  };

  beforeEach(async () => {
    mockUsersRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    } as unknown as UsersRepository;

    mockCfg = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
        {
          provide: ConfigService,
          useValue: mockCfg,
        },
      ],
    });

    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(usersService).toBeDefined();
  });
});
