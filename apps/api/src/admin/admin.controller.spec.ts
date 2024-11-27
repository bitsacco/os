import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: {
            getStatus: jest.fn().mockResolvedValue({
              memberStatus: {
                hasShares: false,
              },
              swapStatus: {
                isRunning: true
              }
            })
          }
        }
      ]
    });

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
