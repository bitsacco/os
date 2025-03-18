import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { LnurlMetricsService } from '@bitsacco/common';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { ChamaController } from './chama.controller';
import { ChamasService } from './chamas/chamas.service';

const mockLnurlMetricsService = {
  recordWithdrawalMetric: jest.fn(),
  getMetrics: jest.fn(),
  resetMetrics: jest.fn(),
};
const callback = 'https://example.com/withdraw/callback';
const mockConfigService = {
  getOrThrow: jest.fn().mockImplementation((key, defaultValue) => {
    const config = {
      LNURL_CALLBACK: callback,
    };
    return config[key] || defaultValue;
  }),
};

describe('ChamaController', () => {
  let chamaController: ChamaController;
  let chamaService: ChamasService;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      controllers: [ChamaController],
      providers: [
        ChamasService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LnurlMetricsService,
          useValue: mockLnurlMetricsService,
        },
      ],
    });

    chamaController = app.get<ChamaController>(ChamaController);
    chamaService = app.get<ChamasService>(ChamasService);
  });
});
