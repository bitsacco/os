import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FedimintService } from './fedimint.service';

describe('FedimintService', () => {
  let mockCfg: jest.Mocked<ConfigService> = {
    getOrThrow: jest.fn(),
  } as any;

  beforeEach(async () => {
    mockCfg = {
      getOrThrow: jest.fn(),
    } as any;
  });

  it('should initialize successfully with all required parameters', async () => {
    const fedimintService = await createFedimintService(mockCfg);

    // Initialize with all required parameters
    expect(() => {
      fedimintService.initialize(
        'http://localhost:2121',
        'federation123',
        'gateway123',
        'password',
        'https://api.bitsacco.com/lnurl',
      );
    }).not.toThrow();
  });

  it('should initialize successfully without optional lnUrlCallback', async () => {
    const fedimintService = await createFedimintService(mockCfg);

    // Initialize without optional lnUrlCallback
    expect(() => {
      fedimintService.initialize(
        'http://localhost:2121',
        'federation123',
        'gateway123',
        'password',
      );
    }).not.toThrow();
  });

  describe('createLnUrlWithdrawPoint', () => {
    let fedimintService: FedimintService;
    let mockHttpService: Partial<HttpService>;
    let mockEventEmitter: Partial<EventEmitter2>;

    beforeEach(async () => {
      // Mock config service
      (mockCfg.getOrThrow as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case 'FEDIMINT_CLIENTD_BASE_URL':
            return 'http://localhost:2121';
          case 'FEDIMINT_CLIENTD_PASSWORD':
            return 'password';
          case 'FEDIMINT_FEDERATION_ID':
            return 'federation123';
          case 'FEDIMINT_GATEWAY_ID':
            return 'gateway123';
          case 'LNURL_CALLBACK':
            return 'https://api.bitsacco.com/solowallet/lnurl';
          default:
            throw new Error(`${key} not found`);
        }
      });

      // Mock HTTP service
      mockHttpService = {
        post: jest.fn(),
      };

      // Mock event emitter
      mockEventEmitter = {
        emit: jest.fn(),
      };

      // Create service
      const module: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule],
        providers: [
          FedimintService,
          {
            provide: ConfigService,
            useValue: mockCfg,
          },
          {
            provide: HttpService,
            useValue: mockHttpService,
          },
          {
            provide: EventEmitter2,
            useValue: mockEventEmitter,
          },
        ],
      }).compile();

      fedimintService = module.get<FedimintService>(FedimintService);

      // Initialize the service with test values
      fedimintService.initialize(
        'http://localhost:2121',
        'federation123',
        'gateway123',
        'password',
        'https://api.bitsacco.com/solowallet/lnurl',
      );
    });

    it('should create a valid LNURL withdraw point', async () => {
      // Test creating a withdraw point
      const result = await fedimintService.createLnUrlWithdrawPoint(
        1000000, // 1000 sats
        1000, // min 1 sat
        'Test LNURL Withdraw',
        3600, // 1 hour expiry
      );

      // Validate the result
      expect(result).toBeDefined();
      expect(result.lnurl).toBeDefined();
      expect(result.lnurl.startsWith('lnurl')).toBeTruthy();
      expect(result.k1).toBeDefined();
      expect(result.k1.length).toBeGreaterThan(10);
      expect(result.callback).toBe('https://api.bitsacco.com/solowallet/lnurl');
      expect(result.expiresAt).toBeDefined();

      // Current timestamp plus expiry should be close to the returned expiresAt
      const expectedExpiry = Math.floor(Date.now() / 1000) + 3600;
      expect(Math.abs(result.expiresAt - expectedExpiry)).toBeLessThan(5); // Allow 5 second difference
    });

    it('should handle long URLs by creating a simplified LNURL', async () => {
      // Create a very long description to force URL simplification
      const longDescription = 'A'.repeat(500);

      const result = await fedimintService.createLnUrlWithdrawPoint(
        1000000,
        1000,
        longDescription,
        3600,
      );

      // Verify we got a valid result even with the long description
      expect(result).toBeDefined();
      expect(result.lnurl).toBeDefined();
      expect(result.lnurl.startsWith('lnurl')).toBeTruthy();
    });

    it('should throw an error if LNURL_CALLBACK is not configured', async () => {
      // Create a new service instance without initializing lnUrlCallback
      const module: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule],
        providers: [
          FedimintService,
          {
            provide: ConfigService,
            useValue: mockCfg,
          },
          {
            provide: HttpService,
            useValue: mockHttpService,
          },
          {
            provide: EventEmitter2,
            useValue: mockEventEmitter,
          },
        ],
      }).compile();

      const uninitializedService = module.get<FedimintService>(FedimintService);

      // Initialize without lnUrlCallback
      uninitializedService.initialize(
        'http://localhost:2121',
        'federation123',
        'gateway123',
        'password',
        // No lnUrlCallback provided
      );

      // Expect error when creating withdraw point without lnUrlCallback
      await expect(
        uninitializedService.createLnUrlWithdrawPoint(1000000),
      ).rejects.toThrow(
        'LNURL withdrawal creation failed: LNURL callback URL not configured',
      );
    });
  });
});

async function createFedimintService(mockCfg: jest.Mocked<ConfigService>) {
  const module: TestingModule = await Test.createTestingModule({
    imports: [ConfigModule, HttpModule],
    providers: [
      FedimintService,
      {
        provide: ConfigService,
        useValue: mockCfg,
      },
      {
        provide: EventEmitter2,
        useValue: {
          emit: jest.fn(),
        },
      },
    ],
  }).compile();

  return module.get<FedimintService>(FedimintService);
}
