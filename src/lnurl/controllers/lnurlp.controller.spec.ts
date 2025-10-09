import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'bun:test';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { LnurlPaymentController } from './lnurlp.controller';
import { LnurlPaymentService } from '../services/lnurl-payment.service';
import { WithdrawalMonitorService } from '../../personal/services/withdrawal-monitor.service';
import { JwtAuthGuard } from '../../common/auth/jwt.auth';
import { WalletType } from '../dto';
import {
  createMockFunction,
  createCommonMocks,
  createMockUser,
} from '../test-utils';
import type { User } from '../../common/types';

describe('LnurlPaymentController', () => {
  let controller: LnurlPaymentController;
  let paymentService: any;
  let monitorService: any;

  beforeEach(async () => {
    const { reflector, jwtService } = createCommonMocks();

    paymentService = {
      payExternal: createMockFunction(),
      getExternalPaymentHistory: createMockFunction(),
    };

    monitorService = {
      checkWithdrawalSecurity: createMockFunction().mockResolvedValue({
        allowed: true,
        riskLevel: 'LOW',
        reason: null,
      }),
      recordSuccessfulWithdrawal: createMockFunction(),
      recordFailedWithdrawal: createMockFunction(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LnurlPaymentController],
      providers: [
        { provide: LnurlPaymentService, useValue: paymentService },
        { provide: WithdrawalMonitorService, useValue: monitorService },
        { provide: Reflector, useValue: reflector },
        { provide: JwtService, useValue: jwtService },
        JwtAuthGuard,
      ],
    }).compile();

    controller = module.get<LnurlPaymentController>(LnurlPaymentController);
  });

  describe('payExternal', () => {
    it('should initiate external payment successfully', async () => {
      const dto = {
        userId: 'test-user-id',
        walletType: WalletType.PERSONAL,
        target: 'alice@wallet.com',
        amountSats: 1000,
        reference: 'Test payment',
      };

      const expectedResult = {
        success: true,
        txId: 'test-tx-id',
        message: 'Payment initiated successfully',
      };

      paymentService.payExternal.mockResolvedValue(expectedResult);

      const result = await controller.payExternal(dto);

      expect(result).toEqual(expectedResult);
      expect(paymentService.payExternal.calls.length).toBe(1);
      expect(paymentService.payExternal.calls[0][0]).toEqual({
        userId: dto.userId,
        walletType: dto.walletType,
        lightningAddress: dto.target,
        amountSats: dto.amountSats,
        comment: undefined,
        reference: dto.reference,
        chamaId: undefined,
        txId: undefined,
      });
    });

    it('should handle chama wallet payments', async () => {
      const dto = {
        userId: 'test-user-id',
        walletType: WalletType.CHAMA,
        chamaId: 'test-chama-id',
        target: 'bob@lightning.com',
        amountSats: 2000,
        reference: 'Chama payment',
        txId: 'existing-tx-id',
      };

      const expectedResult = {
        success: true,
        txId: 'test-tx-id',
        message: 'Payment continued successfully',
      };

      paymentService.payExternal.mockResolvedValue(expectedResult);

      const result = await controller.payExternal(dto);

      expect(result).toEqual(expectedResult);
      expect(paymentService.payExternal.calls[0][0].chamaId).toBe(dto.chamaId);
      expect(paymentService.payExternal.calls[0][0].txId).toBe(dto.txId);
    });

    it('should handle payment with comment', async () => {
      const dto = {
        userId: 'test-user-id',
        walletType: WalletType.PERSONAL,
        target: 'charlie@node.com',
        amountSats: 500,
        reference: 'Coffee payment',
        comment: 'Thanks for the coffee!',
      };

      const expectedResult = {
        success: true,
        txId: 'test-tx-id',
        message: 'Payment initiated successfully',
      };

      paymentService.payExternal.mockResolvedValue(expectedResult);

      const result = await controller.payExternal(dto);

      expect(result).toEqual(expectedResult);
      expect(paymentService.payExternal.calls[0][0].comment).toBe(dto.comment);
    });

    it('should handle payment failure', async () => {
      const dto = {
        userId: 'test-user-id',
        walletType: WalletType.PERSONAL,
        target: 'invalid@wallet.com',
        amountSats: 1000,
        reference: 'Test payment',
      };

      const expectedResult = {
        success: false,
        txId: '',
        message: 'Payment failed',
        error: 'Invalid lightning address',
      };

      paymentService.payExternal.mockResolvedValue(expectedResult);

      const result = await controller.payExternal(dto);

      expect(result).toEqual(expectedResult);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history', async () => {
      const user = createMockUser();
      const query = { limit: 10, offset: 0 };

      const mockPayments = [
        {
          _id: 'payment-1',
          amountMsats: 1000000,
          amountFiat: 100,
          currency: 'KES',
          status: 'COMPLETE',
          lnurlData: {
            externalPay: {
              targetAddress: 'alice@wallet.com',
              targetDomain: 'wallet.com',
              comment: 'Test payment',
            },
          },
          createdAt: new Date('2024-01-01'),
          completedAt: new Date('2024-01-01'),
        },
      ];

      paymentService.getExternalPaymentHistory.mockResolvedValue({
        payments: mockPayments,
        total: 1,
      });

      const result = await controller.getPaymentHistory(user, query);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual({
        id: 'payment-1',
        amountMsats: 1000000,
        amountFiat: 100,
        currency: 'KES',
        status: 'COMPLETE',
        target: {
          address: 'alice@wallet.com',
          url: undefined,
          domain: 'wallet.com',
        },
        comment: 'Test payment',
        createdAt: mockPayments[0].createdAt,
        completedAt: mockPayments[0].completedAt,
      });

      expect(paymentService.getExternalPaymentHistory.calls.length).toBe(1);
      expect(paymentService.getExternalPaymentHistory.calls[0]).toEqual([
        user.id,
        { limit: 10, offset: 0 },
      ]);
    });

    it('should handle empty payment history', async () => {
      const user = createMockUser();
      const query = { limit: 10, offset: 0 };

      paymentService.getExternalPaymentHistory.mockResolvedValue({
        payments: [],
        total: 0,
      });

      const result = await controller.getPaymentHistory(user, query);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should use default pagination values', async () => {
      const user = createMockUser();
      const query = {}; // No pagination params

      paymentService.getExternalPaymentHistory.mockResolvedValue({
        payments: [],
        total: 0,
      });

      await controller.getPaymentHistory(user, query);

      // Check that default values from PaginationDto are used
      expect(paymentService.getExternalPaymentHistory.calls[0][1]).toEqual({
        limit: undefined,
        offset: undefined,
      });
    });
  });
});
