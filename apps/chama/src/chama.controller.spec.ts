import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { LnurlMetricsService } from '@bitsacco/common';
import { ChamaController } from './chama.controller';
import { ChamasService } from './chamas/chamas.service';
import { ChamaWalletService } from './wallet/wallet.service';

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
  let chamaWalletService: ChamaWalletService;

  const mockChamaWalletService = {
    aggregateWalletMeta: jest.fn(),
    aggregateBulkWalletMeta: jest.fn(),
    deposit: jest.fn(),
    continueDeposit: jest.fn(),
    requestWithdraw: jest.fn(),
    continueWithdraw: jest.fn(),
    updateTransaction: jest.fn(),
    findTransaction: jest.fn(),
    filterTransactions: jest.fn(),
    findApprovedLnurlWithdrawal: jest.fn(),
    processLnUrlWithdrawCallback: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ChamaController],
      providers: [
        {
          provide: ChamasService,
          useValue: {
            createChama: jest.fn(),
            updateChama: jest.fn(),
            joinChama: jest.fn(),
            inviteMembers: jest.fn(),
            findChama: jest.fn(),
            filterChamas: jest.fn(),
          },
        },
        {
          provide: ChamaWalletService,
          useValue: mockChamaWalletService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LnurlMetricsService,
          useValue: mockLnurlMetricsService,
        },
      ],
    }).compile();

    chamaController = app.get<ChamaController>(ChamaController);
    chamaService = app.get<ChamasService>(ChamasService);
    chamaWalletService = app.get<ChamaWalletService>(ChamaWalletService);
  });

  describe('aggregateBulkWalletMeta', () => {
    it('should call wallet service to aggregate bulk wallet meta', async () => {
      // Arrange
      const request = {
        chamaIds: ['chama1', 'chama2'],
        selectMemberIds: ['user1'],
        skipMemberMeta: false,
      };

      const expectedResponse = {
        meta: [
          {
            chamaId: 'chama1',
            groupMeta: {
              groupDeposits: 100000,
              groupWithdrawals: 50000,
              groupBalance: 50000,
            },
            memberMeta: [
              {
                memberId: 'user1',
                memberMeta: {
                  memberDeposits: 100000,
                  memberWithdrawals: 50000,
                  memberBalance: 50000,
                },
              },
            ],
          },
          {
            chamaId: 'chama2',
            groupMeta: {
              groupDeposits: 200000,
              groupWithdrawals: 100000,
              groupBalance: 100000,
            },
            memberMeta: [
              {
                memberId: 'user1',
                memberMeta: {
                  memberDeposits: 200000,
                  memberWithdrawals: 100000,
                  memberBalance: 100000,
                },
              },
            ],
          },
        ],
      };

      mockChamaWalletService.aggregateBulkWalletMeta.mockResolvedValue(
        expectedResponse,
      );

      // Act
      const result = await chamaController.aggregateBulkWalletMeta(request);

      // Assert
      expect(result).toBe(expectedResponse);
      expect(
        mockChamaWalletService.aggregateBulkWalletMeta,
      ).toHaveBeenCalledWith(request);
    });
  });
});
