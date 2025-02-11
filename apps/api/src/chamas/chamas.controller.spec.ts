import { TestingModule } from '@nestjs/testing';
import {
  ChamasRepository,
  ChamasService,
  UsersService,
} from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ChamasController } from './chamas.controller';
import { ChamaMessageService } from 'libs/common/src/chamas/chamas.messaging';

describe('ChamasController', () => {
  let chamaController: ChamasController;
  let chamaService: ChamasService;
  let messageService: ChamaMessageService;
  let chamasRepository: ChamasRepository;
  let usersService: UsersService;

  beforeEach(async () => {
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
      controllers: [ChamasController],
      providers: [
        {
          provide: ChamasService,
          useFactory: () => {
            return new ChamasService(
              chamasRepository,
              usersService,
              messageService,
            );
          },
        },
      ],
    });

    chamaController = module.get<ChamasController>(ChamasController);
    chamaService = module.get<ChamasService>(ChamasService);
  });

  it('should be defined', () => {
    expect(chamaController).toBeDefined();
    expect(chamaService).toBeDefined();
  });
});
