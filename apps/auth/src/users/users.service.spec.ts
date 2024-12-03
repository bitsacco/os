import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let service: UsersService;
  let mockUsersRepository: UsersRepository;

  beforeEach(async () => {
    mockUsersRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    } as unknown as UsersRepository;

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
      ],
    });

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
