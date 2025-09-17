import { of } from 'rxjs';
import { Test } from '@nestjs/testing';
import { ChamasService } from './chamas.service';
import { ChamaWalletService } from '../chamawallet/wallet.service';
import { JwtService } from '@nestjs/jwt';
import {
  ChamaUpdatesDto,
  JwtAuthGuard,
  BulkChamaTxMetaRequestDto,
} from '../common';
import { ChamasController } from './chamas.controller';
import { ChamaMemberGuard } from './chama-member.guard';
import { ChamaFilterGuard } from './chama-filter.guard';
import { ChamaBulkAccessGuard } from './chama-bulk-access.guard';
import { ConfigService } from '@nestjs/config';

// Mock classes
class MockGuard {
  canActivate() {
    return true;
  }
}

describe('ChamasController', () => {
  let chamaController: ChamasController;
  let module: any;

  // Mock service methods
  const chamasServiceMock = {
    createChama: jest.fn().mockResolvedValue({}),
    updateChama: jest.fn().mockResolvedValue({}),
    joinChama: jest.fn().mockResolvedValue({}),
    inviteMembers: jest.fn().mockResolvedValue({}),
    findChama: jest.fn().mockResolvedValue({}),
    filterChamas: jest.fn().mockResolvedValue({ chamas: [] }),
    getMemberProfiles: jest.fn().mockResolvedValue({ members: [] }),
  };

  const chamaWalletServiceMock = {
    deposit: jest.fn().mockResolvedValue({}),
    continueDeposit: jest.fn().mockResolvedValue({}),
    requestWithdraw: jest.fn().mockResolvedValue({}),
    continueWithdraw: jest.fn().mockResolvedValue({}),
    updateTransaction: jest.fn().mockResolvedValue({}),
    findTransaction: jest.fn().mockResolvedValue({}),
    filterTransactions: jest.fn().mockResolvedValue({}),
    aggregateWalletMeta: jest.fn().mockResolvedValue({}),
    aggregateBulkWalletMeta: jest.fn().mockResolvedValue({}),
  };

  const mockJwtService = {
    decode: jest.fn().mockReturnValue({ user: { id: 'test-user-id' } }),
  };

  const mockCircuitBreaker = {
    execute: jest.fn().mockImplementation((serviceKey, observable) => {
      return observable;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      controllers: [ChamasController],
      providers: [
        {
          provide: ChamasService,
          useValue: chamasServiceMock,
        },
        {
          provide: ChamaWalletService,
          useValue: chamaWalletServiceMock,
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
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    chamaController = module.get(ChamasController);
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

      await chamaController.aggregateBulkWalletMeta(bulkRequest);

      expect(
        chamaWalletServiceMock.aggregateBulkWalletMeta,
      ).toHaveBeenCalledWith(bulkRequest);
    });

    it('should handle empty chamaIds array', async () => {
      const bulkRequest: BulkChamaTxMetaRequestDto = {
        chamaIds: [],
        selectMemberIds: [],
      };

      await chamaController.aggregateBulkWalletMeta(bulkRequest);

      expect(
        chamaWalletServiceMock.aggregateBulkWalletMeta,
      ).toHaveBeenCalledWith(bulkRequest);
    });
  });

  describe('getMemberProfiles', () => {
    it('should call chamasService.getMemberProfiles with correct parameters', async () => {
      const chamaId = 'test-chama-id';
      await chamaController.getMemberProfiles(chamaId);
      expect(chamasServiceMock.getMemberProfiles).toHaveBeenCalledWith({
        chamaId,
      });
    });

    it('should handle errors when getting member profiles', async () => {
      const chamaId = 'test-chama-id';
      const errorMessage = 'Error fetching member profiles';

      chamasServiceMock.getMemberProfiles.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      try {
        await chamaController.getMemberProfiles(chamaId);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toEqual(errorMessage);
      }
    });
  });
});
