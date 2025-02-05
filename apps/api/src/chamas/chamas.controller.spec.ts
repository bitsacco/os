import { TestingModule } from '@nestjs/testing';
import { ChamasRepository, ChamasService } from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ChamasController } from './chamas.controller';

describe('ChamasController', () => {
  let controller: ChamasController;
  let service: ChamasService;
  let mockChamasRepository: ChamasRepository;

  beforeEach(async () => {
    mockChamasRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    } as unknown as ChamasRepository;

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [ChamasController],
      providers: [
        {
          provide: ChamasService,
          useFactory: () => {
            return new ChamasService(mockChamasRepository);
          },
        },
      ],
    });

    controller = module.get<ChamasController>(ChamasController);
    service = module.get<ChamasService>(ChamasService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
