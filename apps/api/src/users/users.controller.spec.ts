import { TestingModule } from '@nestjs/testing';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { UsersController } from './users.controller';
import { UsersService, UsersRepository } from '@bitsacco/common';

describe('UsersController', () => {
  let controller: UsersController;
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

    const jwtAuthMocks = provideJwtAuthStrategyMocks();
    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useFactory: () => {
            return new UsersService(mockUsersRepository);
          },
        },
        ...jwtAuthMocks,
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
