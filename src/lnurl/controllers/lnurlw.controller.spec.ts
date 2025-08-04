import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'bun:test';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { LnurlWithdrawController } from './lnurlw.controller';
import { LnurlWithdrawService } from '../services/lnurl-withdraw.service';
import { JwtAuthGuard } from '../../common/auth/jwt.auth';
import {
  createMockFunction,
  createCommonMocks,
  createMockUser,
} from '../test-utils';

describe('LnurlWithdrawController', () => {
  let controller: LnurlWithdrawController;
  let lnurlWithdrawService: any;

  const mockUser = createMockUser({ id: 'user123', userId: 'user123' });

  beforeEach(async () => {
    const { reflector, jwtService } = createCommonMocks();

    const mockLnurlWithdrawService = {
      handleWithdrawQuery: createMockFunction(),
      processWithdrawCallback: createMockFunction(),
      createWithdrawLink: createMockFunction(),
      listWithdrawals: createMockFunction(),
      getWithdrawalStatus: createMockFunction(),
      cancelWithdrawal: createMockFunction(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LnurlWithdrawController],
      providers: [
        { provide: LnurlWithdrawService, useValue: mockLnurlWithdrawService },
        { provide: JwtService, useValue: jwtService },
        { provide: Reflector, useValue: reflector },
        JwtAuthGuard,
      ],
    }).compile();

    controller = module.get<LnurlWithdrawController>(LnurlWithdrawController);
    lnurlWithdrawService = module.get(LnurlWithdrawService);
  });

  describe('lnurlCallback', () => {
    it('should handle withdraw query (first step) when pr is not provided', async () => {
      const k1 = 'a1b2c3d4e5f6';
      const mockResponse = {
        callback: 'https://bitsacco.com/v1/lnurl/withdraw/callback',
        k1: k1,
        tag: 'withdrawRequest',
        defaultDescription: 'Bitsacco withdrawal',
        minWithdrawable: 1000,
        maxWithdrawable: 100000000,
      };

      lnurlWithdrawService.handleWithdrawQuery.mockResolvedValue(mockResponse);

      const result = await controller.lnurlCallback(k1);

      expect(lnurlWithdrawService.handleWithdrawQuery.calls).toContainEqual([
        k1,
      ]);
      expect(result).toEqual(mockResponse);
    });

    it('should handle withdraw callback (second step) when pr is provided', async () => {
      const k1 = 'a1b2c3d4e5f6';
      const pr = 'lnbc10n1p3...';
      const mockResponse = {
        status: 'OK',
      };

      lnurlWithdrawService.processWithdrawCallback.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.lnurlCallback(k1, pr);

      expect(lnurlWithdrawService.processWithdrawCallback.calls).toContainEqual(
        [k1, pr],
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return error when k1 parameter is missing', async () => {
      const result = await controller.lnurlCallback('');

      expect(result).toEqual({
        status: 'ERROR',
        reason: 'Missing k1 parameter',
      });
    });

    it('should return error when service throws exception', async () => {
      const k1 = 'a1b2c3d4e5f6';
      const errorMessage = 'Invalid or expired withdrawal link';

      lnurlWithdrawService.handleWithdrawQuery.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await controller.lnurlCallback(k1);

      expect(result).toEqual({
        status: 'ERROR',
        reason: errorMessage,
      });
    });

    it('should handle service error without message', async () => {
      const k1 = 'a1b2c3d4e5f6';

      lnurlWithdrawService.handleWithdrawQuery.mockRejectedValue(new Error());

      const result = await controller.lnurlCallback(k1);

      expect(result).toEqual({
        status: 'ERROR',
        reason: 'Failed to process withdrawal',
      });
    });
  });

  describe('createWithdrawal', () => {
    it('should create withdrawal link successfully', async () => {
      const req = { user: mockUser } as any;
      const createData = {
        amountMsats: 100000000,
        description: 'Test withdrawal',
        expiryMinutes: 60,
        singleUse: true,
        minWithdrawable: 1000,
        maxWithdrawable: 100000000,
      };

      const mockResponse = {
        _id: '507f1f77bcf86cd799439011',
        k1: 'a1b2c3d4e5f6',
        lnurl: 'LNURL1DP68GURN8GHJ7...',
        qrCode: 'data:image/svg+xml;base64,...',
        minWithdrawable: 1000,
        maxWithdrawable: 100000000,
        remainingUses: 1,
        expiresAt: '2024-01-15T12:00:00Z',
      };

      lnurlWithdrawService.createWithdrawLink.mockResolvedValue(mockResponse);

      const result = await controller.createWithdrawal(req, createData);

      expect(lnurlWithdrawService.createWithdrawLink.calls).toContainEqual([
        mockUser.id,
        createData,
      ]);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listWithdrawals', () => {
    it('should list user withdrawals with default pagination', async () => {
      const req = { user: mockUser } as any;
      const mockResponse = {
        withdrawals: [
          {
            _id: '507f1f77bcf86cd799439011',
            status: 'active',
            amountMsats: 100000000,
            usedCount: 0,
            remainingUses: 1,
            createdAt: '2024-01-15T10:00:00Z',
          },
        ],
        total: 1,
      };

      lnurlWithdrawService.listWithdrawals.mockResolvedValue(mockResponse);

      const result = await controller.listWithdrawals(req);

      expect(lnurlWithdrawService.listWithdrawals.calls).toContainEqual([
        mockUser.id,
        20,
        0,
      ]);
      expect(result).toEqual(mockResponse);
    });

    it('should list user withdrawals with custom pagination', async () => {
      const req = { user: mockUser } as any;
      const limit = 10;
      const offset = 5;
      const mockResponse = {
        withdrawals: [],
        total: 0,
      };

      lnurlWithdrawService.listWithdrawals.mockResolvedValue(mockResponse);

      const result = await controller.listWithdrawals(req, limit, offset);

      expect(lnurlWithdrawService.listWithdrawals.calls).toContainEqual([
        mockUser.id,
        limit,
        offset,
      ]);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getWithdrawalStatus', () => {
    it('should return withdrawal status', async () => {
      const req = { user: mockUser } as any;
      const withdrawId = '507f1f77bcf86cd799439011';
      const mockResponse = {
        _id: withdrawId,
        k1: 'a1b2c3d4e5f6',
        status: 'active',
        amountMsats: 100000000,
        withdrawnMsats: 50000000,
        remainingMsats: 50000000,
        usedCount: 1,
        remainingUses: 0,
        lastUsedAt: '2024-01-15T11:00:00Z',
        expiresAt: '2024-01-16T10:00:00Z',
      };

      lnurlWithdrawService.getWithdrawalStatus.mockResolvedValue(mockResponse);

      const result = await controller.getWithdrawalStatus(req, withdrawId);

      expect(lnurlWithdrawService.getWithdrawalStatus.calls).toContainEqual([
        withdrawId,
        mockUser.id,
      ]);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('cancelWithdrawal', () => {
    it('should cancel withdrawal successfully', async () => {
      const req = { user: mockUser } as any;
      const withdrawId = '507f1f77bcf86cd799439011';

      lnurlWithdrawService.cancelWithdrawal.mockResolvedValue(undefined);

      const result = await controller.cancelWithdrawal(req, withdrawId);

      expect(lnurlWithdrawService.cancelWithdrawal.calls).toContainEqual([
        withdrawId,
        mockUser.id,
      ]);
      expect(result).toEqual({ message: 'Withdrawal cancelled successfully' });
    });
  });
});
