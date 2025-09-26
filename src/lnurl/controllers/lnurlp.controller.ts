import {
  Controller,
  Logger,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LnurlPaymentService } from '../services/lnurl-payment.service';
import { WithdrawalMonitorService } from '../../personal/services/withdrawal-monitor.service';
import { AtomicWithdrawalService } from '../../personal/services/atomic-withdrawal.service';
import {
  ExternalPaymentDto,
  PaginationDto,
  PaymentHistoryResponseDto,
  ExternalPaymentResponseDto,
} from '../dto';
import { JwtAuthGuard } from '../../common/auth/jwt.auth';
import { CurrentUser } from '../../common/auth/decorators';
import type { User } from '../../common/types';

@Controller('lnurlp')
export class LnurlPaymentController {
  private readonly logger = new Logger(LnurlPaymentController.name);

  constructor(
    private readonly lnurlPaymentService: LnurlPaymentService,
    private readonly monitorService: WithdrawalMonitorService,
    private readonly atomicWithdrawalService: AtomicWithdrawalService,
  ) {}

  @Post('external')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Make payment to external Lightning Address or LNURL',
    description:
      'Send a payment to an external Lightning Address (e.g., alice@wallet.com) or LNURL. ' +
      'This endpoint resolves the Lightning address, fetches the invoice, ' +
      'and delegates the payment to the appropriate wallet service. ' +
      'Protected by multi-layer rate limiting and security monitoring.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment initiated successfully',
    type: ExternalPaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payment request' })
  @ApiResponse({ status: 403, description: 'Payment limit exceeded' })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - rate limit exceeded',
  })
  @ApiResponse({ status: 503, description: 'External service unavailable' })
  async payExternal(
    @Body() dto: ExternalPaymentDto,
  ): Promise<ExternalPaymentResponseDto> {
    this.logger.log(
      `External payment request from user ${dto.userId} to ${dto.target}`,
    );

    // Step 1: Security monitoring check
    const securityCheck = await this.monitorService.checkWithdrawalSecurity(
      dto.userId,
      dto.amountSats * 1000, // Convert to millisats
      dto.walletType === 'chama' ? dto.chamaId : dto.userId,
    );

    if (!securityCheck.allowed) {
      this.logger.error(
        `Security check failed for user ${dto.userId}: ${securityCheck.reason}`,
      );

      // Log critical risk level for monitoring
      if (securityCheck.riskLevel === 'CRITICAL') {
        this.logger.error(
          `Critical security risk detected for user ${dto.userId}: ${securityCheck.reason}`,
        );
      }

      throw new BadRequestException(
        securityCheck.reason ||
          'Withdrawal not allowed due to security restrictions',
      );
    }

    try {
      // Step 2: Process the withdrawal with atomic operations
      const result = await this.lnurlPaymentService.payExternal({
        userId: dto.userId,
        walletType: dto.walletType,
        chamaId: dto.chamaId,
        lightningAddress: dto.target,
        amountSats: dto.amountSats,
        comment: dto.comment,
        reference: dto.reference,
        txId: dto.txId,
      });

      // Step 3: Record successful withdrawal for monitoring
      if (result.success) {
        // Record in monitoring service
        await this.monitorService.recordSuccessfulWithdrawal(
          dto.userId,
          dto.amountSats * 1000, // Convert to millisats
        );
      }

      return result;
    } catch (error) {
      // Record failed attempt
      await this.monitorService.recordFailedWithdrawal(
        dto.userId,
        dto.amountSats,
        error.message,
      );

      throw error;
    }
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get external payment history',
    description:
      'Retrieve history of payments made to external Lightning Addresses and LNURLs',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment history',
    type: PaymentHistoryResponseDto,
  })
  async getPaymentHistory(
    @CurrentUser() user: User,
    @Query() query: PaginationDto,
  ): Promise<PaymentHistoryResponseDto> {
    this.logger.log(`Fetching payment history for user ${user.id}`);

    const result = await this.lnurlPaymentService.getExternalPaymentHistory(
      user.id,
      {
        limit: query.limit,
        offset: query.offset,
      },
    );

    return {
      items: result.payments.map((payment) => ({
        id: payment._id.toString(),
        amountMsats: payment.amountMsats,
        amountFiat: payment.amountFiat,
        currency: payment.currency.toString(),
        status: payment.status.toString(),
        target: {
          address: payment.lnurlData?.externalPay?.targetAddress,
          url: payment.lnurlData?.externalPay?.targetUrl,
          domain: payment.lnurlData?.externalPay?.targetDomain,
        },
        comment: payment.lnurlData?.externalPay?.comment,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt,
      })),
      total: result.total,
    };
  }
}
