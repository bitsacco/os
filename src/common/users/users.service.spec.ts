import { Test, TestingModule } from '@nestjs/testing';
import { type ClientGrpc } from '@nestjs/microservices';
import { SmsServiceClient } from '../types';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { RoleValidationService } from '../auth/role-validation.service';

describe('UsersService', () => {
  let usersService: UsersService;
  let mockUsersRepository: UsersRepository;
  let mockRoleValidationService: RoleValidationService;
  let serviceGenerator: ClientGrpc;
  let mockSmsServiceClient: Partial<SmsServiceClient>;

  beforeEach(async () => {
    mockUsersRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    } as unknown as UsersRepository;

    mockRoleValidationService = {
      validateRoleUpdate: jest.fn(),
    } as unknown as RoleValidationService;

    serviceGenerator = {
      getService: jest.fn().mockReturnValue(mockSmsServiceClient),
      getClientByServiceName: jest.fn().mockReturnValue(mockSmsServiceClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
        {
          provide: RoleValidationService,
          useValue: mockRoleValidationService,
        },
        {
          provide: UsersService,
          useFactory: () => {
            return new UsersService(
              mockUsersRepository,
              mockRoleValidationService,
            );
          },
        },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(usersService).toBeDefined();
  });
});
