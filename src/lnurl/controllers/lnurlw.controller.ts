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
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { LnurlWithdrawService } from '../services/lnurl-withdraw.service';
import { JwtAuthGuard } from '../../common/auth/jwt.auth';
import type { Request } from 'express';

@Controller({
  path: 'lnurlw',
})
export class LnurlWithdrawController {
  private readonly logger = new Logger(LnurlWithdrawController.name);

  constructor(private readonly lnurlWithdrawService: LnurlWithdrawService) {}

  /**
   * Public endpoint for LNURL-withdraw protocol
   */
  @Get('callback')
  @ApiOperation({
    summary: 'LNURL-withdraw callback',
    description:
      'Public callback endpoint for LNURL-withdraw protocol. ' +
      'First call (without pr): Returns withdrawal details including amount limits. ' +
      'Second call (with pr): Processes the withdrawal by paying the provided Lightning invoice.',
  })
  @ApiQuery({
    name: 'k1',
    type: String,
    required: true,
    description: 'Unique withdrawal identifier (received from QR code or link)',
    example: 'a1b2c3d4e5f6...',
  })
  @ApiQuery({
    name: 'pr',
    type: String,
    required: false,
    description:
      'Lightning invoice (bolt11) to be paid - only provided in second step',
    example: 'lnbc10n1p3...',
  })
  @ApiResponse({
    status: 200,
    description:
      'LNURL-withdraw metadata (first step) or payment confirmation (second step)',
    schema: {
      examples: {
        'First step': {
          value: {
            callback: 'https://bitsacco.com/v1/lnurl/withdraw/callback',
            k1: 'a1b2c3d4e5f6...',
            tag: 'withdrawRequest',
            defaultDescription: 'Bitsacco withdrawal',
            minWithdrawable: 1_000,
            maxWithdrawable: 100_000_000,
          },
        },
        'Second step': {
          value: {
            status: 'OK',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Error response',
    schema: {
      example: {
        status: 'ERROR',
        reason: 'Invalid or expired withdrawal link',
      },
    },
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create LNURL withdrawal link',
    description:
      'Creates a new LNURL-withdraw link that allows anyone with the link to withdraw Bitcoin from your account. ' +
      'You can set withdrawal limits, expiry time, and whether the link is single-use. ' +
      'Returns a QR code and link that can be shared.',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal link created successfully',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        k1: 'a1b2c3d4e5f6...',
        lnurl: 'LNURL1DP68GURN8GHJ7...',
        qrCode: 'data:image/svg+xml;base64,...',
        minWithdrawable: 1_000,
        maxWithdrawable: 100_000_000,
        remainingUses: 1,
        expiresAt: '2024-01-15T12:00:00Z',
      },
    },
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List withdrawal links and history',
    description:
      'Returns a paginated list of LNURL-withdraw links created by the user, ' +
      'including their status, usage history, and remaining balance.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items to return (default: 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of items to skip',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'List of withdrawals',
    schema: {
      example: {
        withdrawals: [
          {
            _id: '507f1f77bcf86cd799439011',
            status: 'active',
            amountMsats: 100_000_000,
            usedCount: 0,
            remainingUses: 1,
            createdAt: '2024-01-15T10:00:00Z',
          },
        ],
        total: 5,
      },
    },
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get withdrawal link details',
    description:
      'Retrieves detailed information about a specific withdrawal link, ' +
      'including its current status, usage history, and remaining balance.',
  })
  @ApiParam({
    name: 'withdrawId',
    type: String,
    description: 'MongoDB ObjectId of the withdrawal link',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal link details',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        k1: 'a1b2c3d4e5f6...',
        status: 'active',
        amountMsats: 100_000_000,
        withdrawnMsats: 50_000_000,
        remainingMsats: 50_000_000,
        usedCount: 1,
        remainingUses: 0,
        lastUsedAt: '2024-01-15T11:00:00Z',
        expiresAt: '2024-01-16T10:00:00Z',
      },
    },
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel withdrawal link',
    description:
      'Cancels an active withdrawal link, preventing further use. ' +
      "Any remaining balance is returned to the user's account. " +
      'Cannot cancel already completed or expired withdrawals.',
  })
  @ApiParam({
    name: 'withdrawId',
    type: String,
    description: 'MongoDB ObjectId of the withdrawal link',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal cancelled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Withdrawal link not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel completed or expired withdrawal',
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
