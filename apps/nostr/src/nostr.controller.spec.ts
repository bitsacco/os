import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { NostrController } from './nostr.controller';
import { NostrService } from './nostr.service';

describe('NostrController', () => {
  let nostrController: NostrController;
  let nostrService: NostrService;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      imports: [],
      controllers: [NostrController],
      providers: [
        {
          provide: NostrService,
          useValue: {
            sendEncryptedDirectMessage: jest.fn(),
            configureNostrRelays: jest.fn(),
          },
        },
      ],
    });

    nostrController = app.get<NostrController>(NostrController);
    nostrService = app.get<NostrService>(NostrService);
  });
});
