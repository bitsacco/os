import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { LnurlWithdrawService } from '../services/lnurl-withdraw.service';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@ApiTags('LNURL Withdraw')
@Controller('lnurl/withdraw')
export class LnurlWithdrawController {
  private readonly logger = new Logger(LnurlWithdrawController.name);

  constructor(private readonly lnurlWithdrawService: LnurlWithdrawService) {}

  /**
   * Public endpoint for LNURL-withdraw protocol
   */
  @Get('callback')
  @ApiOperation({ summary: 'LNURL-withdraw callback (public)' })
  @ApiQuery({
    name: 'k1',
    type: String,
    required: true,
    description: 'Unique withdrawal identifier',
  })
  @ApiQuery({
    name: 'pr',
    type: String,
    required: false,
    description: 'Lightning invoice (payment request) - only in second step',
  })
  @ApiResponse({
    status: 200,
    description: 'LNURL-withdraw response',
  })
  async lnurlCallback(@Query('k1') k1: string, @Query('pr') pr?: string) {
    this.logger.log(
      `LNURL withdraw callback: k1=${k1}, pr=${pr ? 'provided' : 'not provided'}`,
    );

    if (!k1) {
      return {
        status: 'ERROR',
        reason: 'Missing k1 parameter',
      };
    }

    try {
      if (!pr) {
        // First step: wallet is querying for withdrawal parameters
        return await this.lnurlWithdrawService.handleWithdrawQuery(k1);
      } else {
        // Second step: wallet is submitting invoice for payment
        return await this.lnurlWithdrawService.processWithdrawCallback(k1, pr);
      }
    } catch (error) {
      this.logger.error(`LNURL withdraw error: ${error.message}`);
      return {
        status: 'ERROR',
        reason: error.message || 'Failed to process withdrawal',
      };
    }
  }

  /**
   * Create a new withdrawal link
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new LNURL withdrawal link' })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal link created successfully',
  })
  async createWithdrawal(
    @Req() req: Request & { user: any },
    @Body()
    body: {
      amountMsats: number;
      description?: string;
      expiryMinutes?: number;
      singleUse?: boolean;
      minWithdrawable?: number;
      maxWithdrawable?: number;
    },
  ) {
    const userId = req.user.id;

    return await this.lnurlWithdrawService.createWithdrawLink(userId, body);
  }

  /**
   * List user's withdrawals
   */
  @Get('list')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List user withdrawals' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of withdrawals',
  })
  async listWithdrawals(
    @Req() req: Request & { user: any },
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const userId = req.user.id;

    return await this.lnurlWithdrawService.listWithdrawals(
      userId,
      limit || 20,
      offset || 0,
    );
  }

  /**
   * Get withdrawal status
   */
  @Get(':withdrawId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get withdrawal status' })
  @ApiParam({ name: 'withdrawId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal details',
  })
  async getWithdrawalStatus(
    @Req() req: Request & { user: any },
    @Param('withdrawId') withdrawId: string,
  ) {
    const userId = req.user.id;

    return await this.lnurlWithdrawService.getWithdrawalStatus(
      withdrawId,
      userId,
    );
  }

  /**
   * Cancel a withdrawal
   */
  @Delete(':withdrawId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a pending withdrawal' })
  @ApiParam({ name: 'withdrawId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal cancelled successfully',
  })
  async cancelWithdrawal(
    @Req() req: Request & { user: any },
    @Param('withdrawId') withdrawId: string,
  ) {
    const userId = req.user.id;

    await this.lnurlWithdrawService.cancelWithdrawal(withdrawId, userId);

    return { message: 'Withdrawal cancelled successfully' };
  }
}
