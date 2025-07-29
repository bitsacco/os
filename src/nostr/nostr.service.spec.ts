import { Test, TestingModule } from '@nestjs/testing';
import { NostrService } from './nostr.service';
import { ConfigService } from '@nestjs/config';
import { NostrMetricsService } from './nostr.metrics';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('NostrService', () => {
  let service: NostrService;
  let mockCfg: jest.Mocked<ConfigService> = {
    getOrThrow: jest.fn(),
  } as any;

  beforeEach(async () => {
    mockCfg = {
      getOrThrow: jest.fn().mockImplementation((key) => {
        switch (key) {
          case 'NOSTR_PUBLIC_KEY':
            return 'c26253da9951d363833474e9145fa15b56876e532cf138251f9b59ea993de6a7';
          case 'NOSTR_PRIVATE_KEY':
            return 'nsec1yxpf8nqa7fq4vp8qkfwllpcdjkh3n2apsqhw4ee6hrn8yfg62d9sfegrqa';
          default:
            throw new Error('unknown config');
        }
      }),
    } as any;

    const mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
    };

    const mockMetricsService = {
      recordMessageMetric: jest.fn(),
      recordRelayMetric: jest.fn(),
      updateConnectedRelaysCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: mockCfg,
        },
        {
          provide: NostrMetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        NostrService,
      ],
    }).compile();

    service = module.get<NostrService>(NostrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
