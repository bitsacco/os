import { TestingModule } from '@nestjs/testing';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';

import { NostrController } from './nostr.controller';
import { NostrService } from './nostr.service';
import { NostrMetricsService } from './nostr.metrics';
import { ConfigService } from '@nestjs/config';

describe('NostrController', () => {
  let nostrController: NostrController;
  let nostrService: NostrService;

  beforeEach(async () => {
    const jwtAuthMocks = provideJwtAuthStrategyMocks();

    // Create mocks for the services
    const mockNostrService = {
      configureNostrRelays: jest.fn().mockResolvedValue(undefined),
      sendEncryptedDirectMessage: jest.fn().mockResolvedValue(undefined),
    };

    const mockNostrMetricsService = {
      recordRelayMetric: jest.fn(),
      recordMessageMetric: jest.fn(),
      updateConnectedRelaysCount: jest.fn(),
    };

    const mockConfigService = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'NOSTR_PRIVATE_KEY':
            return 'test-private-key';
          case 'NOSTR_PUBLIC_KEY':
            return 'test-public-key';
          default:
            return 'test-value';
        }
      }),
    };

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [NostrController],
      providers: [
        {
          provide: NostrService,
          useValue: mockNostrService,
        },
        {
          provide: NostrMetricsService,
          useValue: mockNostrMetricsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        ...jwtAuthMocks,
      ],
    });

    nostrController = module.get<NostrController>(NostrController);
    nostrService = module.get<NostrService>(NostrService);
  });

  it('should be defined', () => {
    expect(nostrController).toBeDefined();
  });
});
