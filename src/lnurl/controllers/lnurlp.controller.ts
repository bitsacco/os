import {
  Controller,
  Logger,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { LnurlPaymentService } from '../services/lnurl-payment.service';
import {
  ExternalPaymentDto,
  UpdateTargetPreferencesDto,
  ListTargetsQueryDto,
  ListTargetsResponseDto,
  TargetResponseDto,
  PaymentHistoryQueryDto,
  PaymentHistoryResponseDto,
} from '../dto';
import { JwtAuthGuard } from '../../common/auth/jwt.auth';
import { CurrentUser } from '../../common/auth/decorators';
import { User } from '../../common/types';

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
  })
  @ApiResponse({ status: 400, description: 'Invalid payment request' })
  @ApiResponse({ status: 403, description: 'Payment limit exceeded' })
  @ApiResponse({ status: 503, description: 'External service unavailable' })
  async payExternal(@Body() dto: ExternalPaymentDto): Promise<{
    success: boolean;
    txId: string;
    message: string;
    error?: string;
  }> {
    this.logger.log(
      `External payment request from user ${dto.userId} to ${dto.target}`,
    );

    const result = await this.lnurlPaymentService.payExternal({
      userId: dto.userId,
      walletType: dto.walletType,
      lightningAddress: dto.target,
      amountSats: dto.amountSats,
      comment: dto.comment,
      reference: dto.reference,
      idempotencyKey: dto.idempotencyKey,
      txId: dto.txId,
    });

    return result;
  }

  @Get('targets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List saved payment targets',
    description:
      'Get a list of saved Lightning Addresses and LNURLs for quick payments',
  })
  @ApiResponse({
    status: 200,
    description: 'List of saved targets',
    type: ListTargetsResponseDto,
  })
  async getSavedTargets(
    @CurrentUser() user: User,
    @Query() query: ListTargetsQueryDto,
  ): Promise<ListTargetsResponseDto> {
    this.logger.log(`Fetching saved targets for user ${user.id}`);

    const result = await this.lnurlPaymentService.getSavedTargets(user.id, {
      favorites: query.favorites,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      items: result.targets.map((target) => ({
        id: target._id.toString(),
        type: target.type,
        target: target.target,
        stats: target.stats,
        preferences: target.preferences,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      })),
      total: result.total,
    };
  }

  @Get('targets/:targetId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get a specific saved target',
    description: 'Retrieve details of a specific saved payment target',
  })
  @ApiParam({ name: 'targetId', description: 'Target ID' })
  @ApiResponse({
    status: 200,
    description: 'Target details',
    type: TargetResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Target not found' })
  async getSavedTarget(
    @CurrentUser() user: User,
    @Param('targetId') targetId: string,
  ): Promise<TargetResponseDto> {
    this.logger.log(`Fetching target ${targetId} for user ${user.id}`);

    const targets = await this.lnurlPaymentService.getSavedTargets(user.id, {
      limit: 1,
    });

    const target = targets.targets.find((t) => t._id.toString() === targetId);
    if (!target) {
      throw new NotFoundException('Target not found');
    }

    return {
      id: target._id.toString(),
      type: target.type,
      target: target.target,
      stats: target.stats,
      preferences: target.preferences,
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
    };
  }

  @Patch('targets/:targetId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update target preferences',
    description: 'Update preferences for a saved payment target',
  })
  @ApiParam({ name: 'targetId', description: 'Target ID' })
  @ApiResponse({
    status: 200,
    description: 'Target updated successfully',
    type: TargetResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Target not found' })
  async updateTargetPreferences(
    @CurrentUser() user: User,
    @Param('targetId') targetId: string,
    @Body() dto: UpdateTargetPreferencesDto,
  ): Promise<TargetResponseDto> {
    this.logger.log(`Updating target ${targetId} for user ${user.id}`);

    const updated = await this.lnurlPaymentService.updateTargetPreferences(
      user.id,
      targetId,
      dto,
    );

    return {
      id: updated._id.toString(),
      type: updated.type,
      target: updated.target,
      stats: updated.stats,
      preferences: updated.preferences,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  @Delete('targets/:targetId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete saved target',
    description: 'Remove a saved payment target',
  })
  @ApiParam({ name: 'targetId', description: 'Target ID' })
  @ApiResponse({ status: 204, description: 'Target deleted successfully' })
  @ApiResponse({ status: 404, description: 'Target not found' })
  async deleteSavedTarget(
    @CurrentUser() user: User,
    @Param('targetId') targetId: string,
  ): Promise<void> {
    this.logger.log(`Deleting target ${targetId} for user ${user.id}`);

    await this.lnurlPaymentService.deleteSavedTarget(user.id, targetId);
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
    @Query() query: PaymentHistoryQueryDto,
  ): Promise<PaymentHistoryResponseDto> {
    this.logger.log(`Fetching payment history for user ${user.id}`);

    const result = await this.lnurlPaymentService.getExternalPaymentHistory(
      user.id,
      {
        targetId: query.targetId,
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
