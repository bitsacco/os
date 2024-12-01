import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
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

  it('init: throws error if FEDIMINT_CLIENTD_BASE_URL config is not set', async () => {
    (mockCfg.getOrThrow as jest.Mock).mockImplementation((key: string) => {
      throw new Error(`${key} not found`);
    });

    await expect(createFedimintService(mockCfg)).rejects.toThrow();
  });

  it('init: throws error if FEDIMINT_CLIENTD_PASSWORD config is not set', async () => {
    (mockCfg.getOrThrow as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'FEDIMINT_CLIENTD_BASE_URL':
          return 'http://localhost:2121';
        default:
          throw new Error(`${key} not found`);
      }
    });

    await expect(createFedimintService(mockCfg)).rejects.toThrow();
  });

  it('init: throws error if FEDIMINT_FEDERATION_ID config is not set', async () => {
    (mockCfg.getOrThrow as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'FEDIMINT_CLIENTD_BASE_URL':
          return 'http://localhost:2121';
        case 'FEDIMINT_CLIENTD_PASSWORD':
          return 'password';
        default:
          throw new Error(`${key} not found`);
      }
    });

    await expect(createFedimintService(mockCfg)).rejects.toThrow();
  });

  it('init: throws error if FEDIMINT_GATEWAY_ID config is not set', async () => {
    (mockCfg.getOrThrow as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'FEDIMINT_CLIENTD_BASE_URL':
          return 'http://localhost:2121';
        case 'FEDIMINT_CLIENTD_PASSWORD':
          return 'password';
        case 'FEDIMINT_FEDERATION_ID':
          return 'fed11dwwewfewwgwrgrgrwgwrgw';
        default:
          throw new Error(`${key} not found`);
      }
    });

    await expect(createFedimintService(mockCfg)).rejects.toThrow();
  });
});

async function createFedimintService(mockCfg: jest.Mocked<ConfigService>) {
  const module: TestingModule = await createTestingModuleWithValidation({
    imports: [ConfigModule],
    providers: [
      FedimintService,
      {
        provide: ConfigService,
        useValue: mockCfg,
      },
    ],
  });

  return module.get<FedimintService>(FedimintService);
}
