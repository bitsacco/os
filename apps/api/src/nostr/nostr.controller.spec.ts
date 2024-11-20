import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';

import { NostrController } from './nostr.controller';
import { NostrService } from './nostr.service';

describe('NostrController', () => {
  let controller: NostrController;
  let nostrService: NostrService;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [NostrController],
      providers: [
        {
          provide: NostrService,
          useValue: {
            sendEncryptedNostrDm: jest.fn(),
            configureNostrRelays: jest.fn(),
          },
        },
      ],
    });

    controller = module.get<NostrController>(NostrController);
    nostrService = module.get<NostrService>(NostrService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(nostrService).toBeDefined();
  });
});
