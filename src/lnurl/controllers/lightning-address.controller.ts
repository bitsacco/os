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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { LightningAddressService } from '../services/lightning-address.service';
import { AddressType } from '../../common/types/lnurl';
import { CreateLightningAddressDto, UpdateLightningAddressDto } from '../dto';

@ApiTags('Lightning Address')
@Controller()
export class LightningAddressController {
  private readonly logger = new Logger(LightningAddressController.name);

  constructor(
    private readonly lightningAddressService: LightningAddressService,
  ) {}

  /**
   * LNURL-pay endpoint (public)
   * This is the standard .well-known endpoint that external wallets will query
   */
  @Get('.well-known/lnurlp/:address')
  @ApiOperation({
    summary: 'LNURL-pay endpoint for Lightning Address',
    description:
      'Returns LNURL-pay metadata for a Lightning Address. This endpoint is queried by external Lightning wallets.',
  })
  @ApiParam({
    name: 'address',
    description: 'The Lightning Address username (without @domain)',
    example: 'alice',
  })
  @ApiResponse({
    status: 200,
    description: 'LNURL-pay response',
    schema: {
      example: {
        callback: 'https://api.bitsacco.com/v1/lnurl/callback/alice',
        minSendable: 1000,
        maxSendable: 100000000,
        metadata: '[[\"text/plain\",\"Pay to alice@bitsacco.com\"]]',
        tag: 'payRequest',
        commentAllowed: 255,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Lightning Address not found',
  })
  async lnurlPay(@Param('address') address: string) {
    this.logger.log(`LNURL-pay request for address: ${address}`);
    return await this.lightningAddressService.generatePayResponse(address);
  }

  /**
   * LNURL-pay callback endpoint (public)
   * This endpoint is called by external wallets to get an invoice
   */
  @Get('v1/lnurl/callback/:address')
  @ApiOperation({
    summary: 'LNURL-pay callback for Lightning Address',
    description:
      'Called by external wallets to request a Lightning invoice for payment.',
  })
  @ApiParam({
    name: 'address',
    description: 'The Lightning Address username',
    example: 'alice',
  })
  @ApiQuery({
    name: 'amount',
    description: 'Amount in millisatoshis',
    required: true,
    example: 50000,
  })
  @ApiQuery({
    name: 'comment',
    description: 'Optional payment comment',
    required: false,
    example: 'Thanks for the coffee!',
  })
  @ApiResponse({
    status: 200,
    description: 'Lightning invoice response',
    schema: {
      example: {
        pr: 'lnbc500n1p3...',
        routes: [],
        successAction: {
          tag: 'message',
          message: 'Payment received! Thank you.',
        },
      },
    },
  })
  async lnurlCallback(
    @Param('address') address: string,
    @Query('amount') amount: string,
    @Query('comment') comment?: string,
    @Query('nostr') nostr?: string,
  ) {
    this.logger.log(`LNURL callback for ${address}, amount: ${amount}`);

    const amountMsats = parseInt(amount);
    if (isNaN(amountMsats)) {
      throw new Error('Invalid amount');
    }

    return await this.lightningAddressService.processPaymentCallback(
      address,
      amountMsats,
      { comment, nostr: nostr ? JSON.parse(nostr) : undefined },
    );
  }

  /**
   * Create/claim a Lightning Address (authenticated)
   */
  @Post('v1/lnurl/lightning-address')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create or claim a Lightning Address',
    description: 'Allows a user to claim their Lightning Address username.',
  })
  @ApiResponse({
    status: 201,
    description: 'Lightning Address created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Address already taken or user already has an address',
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
   * Get Lightning Address details (authenticated)
   */
  @Get('v1/lnurl/lightning-address/:addressId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Lightning Address details' })
  @ApiParam({ name: 'addressId', description: 'Lightning Address ID' })
  async getAddress(
    @Req() req: Request & { user: any },
    @Param('addressId') addressId: string,
  ) {
    const userId = req.user.id;
    return await this.lightningAddressService.getAddress(addressId, userId);
  }

  /**
   * Update Lightning Address (authenticated)
   */
  @Patch('v1/lnurl/lightning-address/:addressId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Lightning Address settings' })
  @ApiParam({ name: 'addressId', description: 'Lightning Address ID' })
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
   * Delete Lightning Address (authenticated)
   */
  @Delete('v1/lnurl/lightning-address/:addressId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete Lightning Address',
    description: 'Disables a Lightning Address (soft delete)',
  })
  @ApiParam({ name: 'addressId', description: 'Lightning Address ID' })
  async deleteAddress(
    @Req() req: Request & { user: any },
    @Param('addressId') addressId: string,
  ) {
    const userId = req.user.id;
    await this.lightningAddressService.deleteAddress(addressId, userId);
    return { message: 'Lightning Address disabled successfully' };
  }

  /**
   * List user's Lightning Addresses (authenticated)
   */
  @Get('v1/lnurl/lightning-address/my-addresses')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my Lightning Addresses' })
  async listMyAddresses(@Req() req: Request & { user: any }) {
    const userId = req.user.id;
    return await this.lightningAddressService.listUserAddresses(userId);
  }

  /**
   * Get payment history for a Lightning Address (authenticated)
   */
  @Get('v1/lnurl/lightning-address/:addressId/payments')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment history for a Lightning Address' })
  @ApiParam({ name: 'addressId', description: 'Lightning Address ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
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
