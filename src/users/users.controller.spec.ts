import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, JwtAuthStrategy } from '../common/auth/jwt.auth';
import { UsersController } from './users.controller';
import {
  UsersService,
  UsersRepository,
  RoleValidationService,
} from '../common';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;
  let mockUsersRepository: UsersRepository;
  let mockRoleValidationService: RoleValidationService;

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

    const jwtAuthMocks = [
      {
        provide: JwtService,
        useValue: {
          sign: jest.fn(),
          verify: jest.fn(),
          decode: jest.fn(),
        },
      },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn(),
          getOrThrow: jest.fn(),
        },
      },
      {
        provide: Reflector,
        useValue: {
          get: jest.fn(),
          getAllAndOverride: jest.fn(),
        },
      },
      {
        provide: JwtAuthStrategy,
        useValue: {
          validate: jest.fn(),
        },
      },
      {
        provide: JwtAuthGuard,
        useValue: {
          canActivate: jest.fn().mockReturnValue(true),
        },
      },
    ];
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useFactory: () => {
            return new UsersService(
              mockUsersRepository,
              mockRoleValidationService,
            );
          },
        },
        {
          provide: RoleValidationService,
          useValue: mockRoleValidationService,
        },
        ...jwtAuthMocks,
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
