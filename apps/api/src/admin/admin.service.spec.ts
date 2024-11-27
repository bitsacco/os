import { TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { createTestingModuleWithValidation } from '@bitsacco/testing';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [AdminService],
    });

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
