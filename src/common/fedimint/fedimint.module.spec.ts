import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FedimintModule } from './fedimint.module';
import { FedimintService } from './fedimint.service';

describe('FedimintModule', () => {
  it('should throw error when required config values are missing', async () => {
    const mockConfigService = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'CLIENTD_BASE_URL') {
          throw new Error(`Configuration property "${key}" is not defined`);
        }
        return 'dummy-value';
      }),
    };

    try {
      const module: TestingModule = await Test.createTestingModule({
        imports: [FedimintModule, HttpModule, EventEmitterModule.forRoot()],
      })
        .overrideProvider(ConfigService)
        .useValue(mockConfigService)
        .compile();

      // If we get here, try to get the service
      module.get<FedimintService>(FedimintService);

      // Should not reach here
      throw new Error('Expected error was not thrown');
    } catch (error: any) {
      expect(error.message).toContain(
        'Configuration property "CLIENTD_BASE_URL" is not defined',
      );
    }
  });

  it('should create FedimintService when all required config values are present', async () => {
    const mockConfigService = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const configMap: Record<string, string> = {
          CLIENTD_BASE_URL: 'http://localhost:2121',
          FEDERATION_ID: 'federation123',
          GATEWAY_ID: 'gateway123',
          CLIENTD_PASSWORD: 'password123',
          LNURL_CALLBACK_BASE_URL: 'https://api.bitsacco.com',
        };
        return configMap[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [FedimintModule, HttpModule, EventEmitterModule.forRoot()],
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();

    const fedimintService = module.get<FedimintService>(FedimintService);
    expect(fedimintService).toBeDefined();
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
      'CLIENTD_BASE_URL',
    );
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('FEDERATION_ID');
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('GATEWAY_ID');
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
      'CLIENTD_PASSWORD',
    );
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
      'LNURL_CALLBACK_BASE_URL',
    );
  });

  it('should validate each required config parameter', async () => {
    const requiredConfigs = [
      'CLIENTD_BASE_URL',
      'FEDERATION_ID',
      'GATEWAY_ID',
      'CLIENTD_PASSWORD',
      'LNURL_CALLBACK_BASE_URL',
    ];

    for (const missingConfig of requiredConfigs) {
      const mockConfigService = {
        getOrThrow: jest.fn().mockImplementation((key: string) => {
          if (key === missingConfig) {
            throw new Error(`Configuration property "${key}" is not defined`);
          }
          return key === 'CLIENTD_BASE_URL'
            ? 'http://localhost:2121'
            : 'dummy-value';
        }),
      };

      try {
        const module: TestingModule = await Test.createTestingModule({
          imports: [FedimintModule, HttpModule, EventEmitterModule.forRoot()],
        })
          .overrideProvider(ConfigService)
          .useValue(mockConfigService)
          .compile();

        // If we get here, try to get the service
        module.get<FedimintService>(FedimintService);

        // Should not reach here
        throw new Error(
          `Expected error for missing ${missingConfig} was not thrown`,
        );
      } catch (error: any) {
        expect(error.message).toContain(
          `Configuration property "${missingConfig}" is not defined`,
        );
      }
    }
  });
});
