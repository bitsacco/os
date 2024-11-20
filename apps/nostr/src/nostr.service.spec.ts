import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { NostrService } from './nostr.service';
import { ConfigService } from '@nestjs/config';

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

    const module: TestingModule = await createTestingModuleWithValidation({
      providers: [
        {
          provide: ConfigService,
          useValue: mockCfg,
        },
        NostrService,
      ],
    });

    service = module.get<NostrService>(NostrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
