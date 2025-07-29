import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, JwtAuthStrategy } from '../common/auth/jwt.auth';
import { NostrController } from './nostr.controller';
import { NostrService } from './nostr.service';
import { NostrMetricsService } from './nostr.metrics';

describe('NostrController', () => {
  let nostrController: NostrController;
  let nostrService: NostrService;

  beforeEach(async () => {
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

    const module: TestingModule = await Test.createTestingModule({
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
    }).compile();

    nostrController = module.get<NostrController>(NostrController);
    nostrService = module.get<NostrService>(NostrService);
  });

  it('should be defined', () => {
    expect(nostrController).toBeDefined();
  });
});
