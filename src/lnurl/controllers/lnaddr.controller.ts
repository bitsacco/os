import {
  Controller,
  Logger,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  Version,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/auth/jwt.auth';
import { LightningAddressService } from '../services/lightning-address.service';
import { CreateLightningAddressDto, UpdateLightningAddressDto } from '../dto';
import { AddressType } from '../../common/types/lnurl';

@Controller({
  path: 'lnaddr',
  version: '2',
})
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LightningAddressController {
  private readonly logger = new Logger(LightningAddressController.name);

  constructor(
    private readonly lightningAddressService: LightningAddressService,
  ) {}

  /**
   * Create/claim a Lightning Address
   */
  @Post()
  @ApiOperation({
    summary: 'Create or claim a Lightning Address',
    description:
      'Creates a new Lightning Address for the authenticated user. ' +
      'Each user can claim one personal Lightning Address (e.g., alice@bitsacco.com). ' +
      'The address must be unique and follow username conventions (3-32 characters, alphanumeric with dots, underscores, hyphens).',
  })
  @ApiResponse({
    status: 201,
    description: 'Lightning Address created successfully',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        address: 'alice',
        domain: 'bitsacco.com',
        type: 'PERSONAL',
        ownerId: '507f1f77bcf86cd799439012',
        metadata: {
          description: 'Pay to alice@bitsacco.com',
          minSendable: 1000,
          maxSendable: 50000000000000,
        },
        settings: {
          enabled: true,
          allowComments: true,
          notifyOnPayment: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Address already taken or user already has a personal address',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid address format or length',
  })
  async createAddress(
    @Req() req: Request & { user: any },
    @Body() dto: CreateLightningAddressDto,
  ) {
    const userId = req.user.id;
    const type = dto.type || AddressType.PERSONAL;

    return await this.lightningAddressService.createAddress(
      userId,
      dto.address,
      type,
      dto.metadata,
      dto.settings,
    );
  }

  /**
   * List user's Lightning Addresses
   */
  @Get('my-addresses')
  @ApiOperation({
    summary: 'List my Lightning Addresses',
    description:
      'Returns all Lightning Addresses owned by the authenticated user, including personal and Chama addresses.',
  })
  async listMyAddresses(@Req() req: Request & { user: any }) {
    const userId = req.user.id;
    return await this.lightningAddressService.listUserAddresses(userId);
  }

  /**
   * Get Lightning Address details
   */
  @Get(':addressId')
  @ApiOperation({
    summary: 'Get Lightning Address details',
    description:
      'Retrieves detailed information about a specific Lightning Address including metadata, settings, and statistics.',
  })
  @ApiParam({
    name: 'addressId',
    description: 'MongoDB ObjectId of the Lightning Address',
    example: '507f1f77bcf86cd799439011',
  })
  async getAddress(
    @Req() req: Request & { user: any },
    @Param('addressId') addressId: string,
  ) {
    const userId = req.user.id;
    return await this.lightningAddressService.getAddress(addressId, userId);
  }

  /**
   * Update Lightning Address
   */
  @Patch(':addressId')
  @ApiOperation({
    summary: 'Update Lightning Address settings',
    description:
      'Updates Lightning Address metadata or settings. ' +
      'You can modify payment limits, description, comment settings, and notification preferences.',
  })
  @ApiParam({
    name: 'addressId',
    description: 'MongoDB ObjectId of the Lightning Address',
    example: '507f1f77bcf86cd799439011',
  })
  async updateAddress(
    @Req() req: Request & { user: any },
    @Param('addressId') addressId: string,
    @Body() dto: UpdateLightningAddressDto,
  ) {
    const userId = req.user.id;
    return await this.lightningAddressService.updateAddress(
      addressId,
      userId,
      dto,
    );
  }

  /**
   * Delete Lightning Address
   */
  @Delete(':addressId')
  @ApiOperation({
    summary: 'Delete Lightning Address',
    description:
      'Disables a Lightning Address (soft delete). ' +
      'The address becomes unavailable for receiving payments but historical data is preserved. ' +
      'The username may become available for others to claim after deletion.',
  })
  @ApiParam({
    name: 'addressId',
    description: 'MongoDB ObjectId of the Lightning Address',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Lightning Address disabled successfully',
  })
  async deleteAddress(
    @Req() req: Request & { user: any },
    @Param('addressId') addressId: string,
  ) {
    const userId = req.user.id;
    await this.lightningAddressService.deleteAddress(addressId, userId);
    return { message: 'Lightning Address disabled successfully' };
  }

  /**
   * Get payment history for a Lightning Address
   */
  @Get(':addressId/payments')
  @ApiOperation({
    summary: 'Get payment history',
    description:
      'Retrieves paginated payment history for a Lightning Address. ' +
      'Returns incoming payments with details like amount, payer comments, timestamps, and transaction status.',
  })
  @ApiParam({
    name: 'addressId',
    description: 'MongoDB ObjectId of the Lightning Address',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of payments to return (default: 20, max: 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of payments to skip for pagination',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Payment history retrieved successfully',
    schema: {
      example: {
        payments: [
          {
            _id: '507f1f77bcf86cd799439013',
            type: 'PAY_IN',
            amount: 10000,
            status: 'completed',
            comment: 'Thanks for the coffee!',
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 42,
      },
    },
  })
  async getPaymentHistory(
    @Req() req: Request & { user: any },
    @Param('addressId') addressId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const userId = req.user.id;
    return await this.lightningAddressService.getPaymentHistory(
      addressId,
      userId,
      limit || 20,
      offset || 0,
    );
  }
}
