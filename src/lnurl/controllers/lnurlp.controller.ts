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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LnurlPaymentService } from '../services/lnurl-payment.service';
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

  constructor(private readonly lnurlPaymentService: LnurlPaymentService) {}

  @Post('external')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Make payment to external Lightning Address or LNURL',
    description:
      'Send a payment to an external Lightning Address (e.g., alice@wallet.com) or LNURL. ' +
      'This endpoint resolves the Lightning address, fetches the invoice, ' +
      'and delegates the payment to the appropriate wallet service.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment initiated successfully',
    type: ExternalPaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payment request' })
  @ApiResponse({ status: 403, description: 'Payment limit exceeded' })
  @ApiResponse({ status: 503, description: 'External service unavailable' })
  async payExternal(
    @Body() dto: ExternalPaymentDto,
  ): Promise<ExternalPaymentResponseDto> {
    this.logger.log(
      `External payment request from user ${dto.userId} to ${dto.target}`,
    );

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

    return result;
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
