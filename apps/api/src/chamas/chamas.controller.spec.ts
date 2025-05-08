import { of } from 'rxjs';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  CHAMA_WALLET_SERVICE_NAME,
  CHAMAS_SERVICE_NAME,
  ChamaUpdatesDto,
  JwtAuthGuard,
  BulkChamaTxMetaRequestDto,
} from '@bitsacco/common';
import { ChamasController } from './chamas.controller';
import { ChamaMemberGuard } from './chama-member.guard';
import { ChamaFilterGuard } from './chama-filter.guard';
import { ChamaBulkAccessGuard } from './chama-bulk-access.guard';

// Mock classes
class MockGuard {
  canActivate() {
    return true;
  }
}

describe('ChamasController', () => {
  let chamaController: ChamasController;

  // Mock service methods
  const chamasServiceMock = {
    createChama: jest.fn().mockReturnValue(of({})),
    updateChama: jest.fn().mockReturnValue(of({})),
    joinChama: jest.fn().mockReturnValue(of({})),
    inviteMembers: jest.fn().mockReturnValue(of({})),
    findChama: jest.fn().mockReturnValue(of({})),
    filterChamas: jest.fn().mockReturnValue(of({})),
  };

  const chamaWalletServiceMock = {
    deposit: jest.fn().mockReturnValue(of({})),
    continueDeposit: jest.fn().mockReturnValue(of({})),
    requestWithdraw: jest.fn().mockReturnValue(of({})),
    continueWithdraw: jest.fn().mockReturnValue(of({})),
    updateTransaction: jest.fn().mockReturnValue(of({})),
    findTransaction: jest.fn().mockReturnValue(of({})),
    filterTransactions: jest.fn().mockReturnValue(of({})),
    aggregateWalletMeta: jest.fn().mockReturnValue(of({})),
    aggregateBulkWalletMeta: jest.fn().mockReturnValue(of({})),
    processLnUrlWithdraw: jest.fn().mockReturnValue(of({})),
  };

  beforeEach(async () => {
    const mockChamasGrpc = {
      getService: jest.fn().mockReturnValue(chamasServiceMock),
    };

    const mockWalletGrpc = {
      getService: jest.fn().mockReturnValue(chamaWalletServiceMock),
    };

    const mockJwtService = {
      decode: jest.fn().mockReturnValue({ user: { id: 'test-user-id' } }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ChamasController,
        {
          provide: CHAMAS_SERVICE_NAME,
          useValue: mockChamasGrpc,
        },
        {
          provide: CHAMA_WALLET_SERVICE_NAME,
          useValue: mockWalletGrpc,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ChamaMemberGuard,
          useClass: MockGuard,
        },
        {
          provide: ChamaFilterGuard,
          useClass: MockGuard,
        },
        {
          provide: ChamaBulkAccessGuard,
          useClass: MockGuard,
        },
        {
          provide: JwtAuthGuard,
          useClass: MockGuard,
        },
      ],
    }).compile();

    chamaController = module.get<ChamasController>(ChamasController);
  });

  it('should be defined', () => {
    expect(chamaController).toBeDefined();
  });

  describe('createChama', () => {
    it('should call chamasService.createChama with correct parameters', async () => {
      const createChamaDto = {
        name: 'Test Chama',
        createdBy: 'user-1',
        members: [],
        invites: [],
      };
      await chamaController.createChama(createChamaDto);
      expect(chamasServiceMock.createChama).toHaveBeenCalledWith(
        createChamaDto,
      );
    });
  });

  describe('updateChama', () => {
    it('should call chamasService.updateChama with correct parameters', async () => {
      const chamaId = 'chama-1';
      const updates: ChamaUpdatesDto = {
        name: 'Updated Chama',
        addMembers: [],
        updateMembers: [],
      };
      await chamaController.updateChama(chamaId, updates);
      expect(chamasServiceMock.updateChama).toHaveBeenCalledWith({
        chamaId,
        updates,
      });
    });
  });

  describe('joinChama', () => {
    it('should call chamasService.joinChama with correct parameters', async () => {
      const chamaId = 'chama-1';
      const memberInfo = { userId: 'user-1', roles: [0] };
      await chamaController.joinChama(chamaId, memberInfo);
      expect(chamasServiceMock.joinChama).toHaveBeenCalledWith({
        chamaId,
        memberInfo,
      });
    });
  });

  describe('getChama', () => {
    it('should call chamasService.findChama with correct parameters', async () => {
      const chamaId = 'test-chama-id';
      await chamaController.getChama(chamaId);
      expect(chamasServiceMock.findChama).toHaveBeenCalledWith({ chamaId });
    });
  });

  describe('filterChama', () => {
    it('should call chamasService.filterChamas with correct parameters', async () => {
      const memberId = 'member-1';
      const createdBy = 'creator-1';
      const page = 1;
      const size = 10;

      await chamaController.filterChama(memberId, createdBy, page, size);

      expect(chamasServiceMock.filterChamas).toHaveBeenCalledWith({
        memberId,
        createdBy,
        pagination: {
          page,
          size,
        },
      });
    });

    it('should use default pagination values when not provided', async () => {
      await chamaController.filterChama('member-1', 'creator-1');

      expect(chamasServiceMock.filterChamas).toHaveBeenCalledWith({
        memberId: 'member-1',
        createdBy: 'creator-1',
        pagination: {
          page: 0,
          size: 10,
        },
      });
    });
  });

  describe('aggregateBulkWalletMeta', () => {
    it('should call chamaWalletService.aggregateBulkWalletMeta with correct parameters', async () => {
      const bulkRequest: BulkChamaTxMetaRequestDto = {
        chamaIds: ['chama-1', 'chama-2'],
        selectMemberIds: ['user-1', 'user-2'],
        skipMemberMeta: false,
      };

      const mockResponse = {
        meta: [
          {
            chamaId: 'chama-1',
            groupMeta: {
              groupDeposits: 100,
              groupWithdrawals: 50,
              groupBalance: 50,
            },
            memberMeta: [],
          },
          {
            chamaId: 'chama-2',
            groupMeta: {
              groupDeposits: 200,
              groupWithdrawals: 75,
              groupBalance: 125,
            },
            memberMeta: [],
          },
        ],
      };

      // The controller returns the Observable directly, not the resolved value
      chamaWalletServiceMock.aggregateBulkWalletMeta.mockReturnValue(
        of(mockResponse),
      );

      const result = chamaController.aggregateBulkWalletMeta(bulkRequest);

      expect(
        chamaWalletServiceMock.aggregateBulkWalletMeta,
      ).toHaveBeenCalledWith(bulkRequest);
    });

    it('should handle empty chamaIds array', async () => {
      const bulkRequest: BulkChamaTxMetaRequestDto = {
        chamaIds: [],
      };

      const mockResponse = { meta: [] };
      chamaWalletServiceMock.aggregateBulkWalletMeta.mockReturnValue(
        of(mockResponse),
      );

      const result = chamaController.aggregateBulkWalletMeta(bulkRequest);

      expect(
        chamaWalletServiceMock.aggregateBulkWalletMeta,
      ).toHaveBeenCalledWith(bulkRequest);
    });
  });

  describe('lnurl', () => {
    it('should process valid LNURL withdrawal request', async () => {
      const k1 = 'valid-k1-token';
      const tag = 'withdrawRequest';
      const callback = 'https://example.com/callback';
      const maxWithdrawable = '1000';
      const minWithdrawable = '100';
      const defaultDescription = 'Test withdrawal';
      const pr = 'lnbc10n1p...';

      chamaWalletServiceMock.processLnUrlWithdraw.mockReturnValue(
        of({
          status: 'OK',
        }),
      );

      const result = await chamaController.lnurl(
        k1,
        tag,
        callback,
        maxWithdrawable,
        minWithdrawable,
        defaultDescription,
        pr,
      );

      expect(chamaWalletServiceMock.processLnUrlWithdraw).toHaveBeenCalledWith({
        k1,
        tag,
        callback,
        maxWithdrawable,
        minWithdrawable,
        defaultDescription,
        pr,
      });

      expect(result).toEqual({ status: 'OK' });
    });

    it('should handle service errors gracefully', async () => {
      chamaWalletServiceMock.processLnUrlWithdraw.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = await chamaController.lnurl(
        'valid-k1-token-long-enough',
        'withdrawRequest',
        'callback',
        '',
        '',
        '',
        '',
      );

      expect(result).toEqual({
        status: 'ERROR',
        reason: 'Withdrawal request not found or expired',
      });
    });
  });
});
