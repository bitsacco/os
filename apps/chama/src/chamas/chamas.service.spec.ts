import { TestingModule } from '@nestjs/testing';
import { UsersService } from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ChamaMessageService } from './chamas.messaging';
import { ChamasService } from './chamas.service';
import { ChamasRepository } from './db';

describe('ChamasService', () => {
  let chamaService: ChamasService;
  let chamasRepository: ChamasRepository;
  let messageService: ChamaMessageService;
  let usersService: UsersService;

  beforeEach(async () => {
    messageService = {
      sendChamaInvites: jest.fn(),
    } as unknown as ChamaMessageService;

    chamasRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    } as unknown as ChamasRepository;

    usersService = {
      validateUser: jest.fn(),
      registerUser: jest.fn(),
      findUser: jest.fn(),
      verifyUser: jest.fn(),
      updateUser: jest.fn(),
      listUsers: jest.fn(),
    } as unknown as UsersService;

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [
        {
          provide: ChamasRepository,
          useValue: chamasRepository,
        },
        {
          provide: ChamasService,
          useFactory: () => {
            return new ChamasService(
              chamasRepository,
              messageService,
              usersService,
            );
          },
        },
      ],
    });

    chamaService = module.get<ChamasService>(ChamasService);
  });

  it('should be defined', () => {
    expect(chamaService).toBeDefined();
  });
});
