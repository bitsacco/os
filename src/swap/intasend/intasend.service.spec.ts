import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IntasendService } from './intasend.service';
import { SendSTKPushDto } from '../dto';

describe('IntasendService', () => {
  let mockCfg: jest.Mocked<ConfigService> = {
    getOrThrow: jest.fn(),
  } as any;

  beforeEach(async () => {
    mockCfg = {
      getOrThrow: jest.fn(),
    } as any;
  });

  it('init: throws error if INTASEND_PUBLIC_KEY config is not set', async () => {
    (mockCfg.getOrThrow as jest.Mock).mockImplementation((key: string) => {
      throw new Error(`${key} not found`);
    });

    await expect(createIntasendService(mockCfg)).rejects.toThrow(
      'INTASEND_PUBLIC_KEY not found',
    );
  });

  it('init: throws error if INTASEND_PRIVATE_KEY config is not set', async () => {
    (mockCfg.getOrThrow as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'INTASEND_PUBLIC_KEY':
          return 'ISPubKey_test_925ab885-f06d-4ace-8507-4186413a59a4';
        default:
          throw new Error(`${key} not found`);
      }
    });

    await expect(createIntasendService(mockCfg)).rejects.toThrow(
      'INTASEND_PRIVATE_KEY not found',
    );
  });

  it.skip('sendMpesaStkPush: should throw a 401 error when INTASEND_PRIVATE_KEY config is not valid', async () => {
    (mockCfg.getOrThrow as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'INTASEND_PUBLIC_KEY':
          return 'ISPubKey_test_925ab885-f06d-4ace-8507-4186413a59a4';
        case 'INTASEND_PRIVATE_KEY':
          return 'test-api-key';
        default:
          throw new Error(`${key} not found`);
      }
    });

    const payload: SendSTKPushDto = {
      amount: 100,
      phone_number: '254700000000',
      api_ref: 'test-ref',
    };

    const intasendService = await createIntasendService(mockCfg);
    expect(intasendService).toBeDefined();

    await expect(intasendService.sendMpesaStkPush(payload)).rejects.toThrow();
  });
});

async function createIntasendService(mockCfg: jest.Mocked<ConfigService>) {
  const module: TestingModule = await Test.createTestingModule({
    imports: [ConfigModule],
    providers: [
      IntasendService,
      {
        provide: ConfigService,
        useValue: mockCfg,
      },
    ],
  }).compile();

  return module.get<IntasendService>(IntasendService);
}
