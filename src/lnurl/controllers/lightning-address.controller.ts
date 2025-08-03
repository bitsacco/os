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
@Controller('lnurl/lightning-address')
@UseGuards(AuthGuard('jwt'))
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
   * List user's Lightning Addresses
   */
  @Get('my-addresses')
  @ApiOperation({ summary: 'List my Lightning Addresses' })
  async listMyAddresses(@Req() req: Request & { user: any }) {
    const userId = req.user.id;
    return await this.lightningAddressService.listUserAddresses(userId);
  }

  /**
   * Get Lightning Address details
   */
  @Get(':addressId')
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
   * Update Lightning Address
   */
  @Patch(':addressId')
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
   * Delete Lightning Address
   */
  @Delete(':addressId')
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
   * Get payment history for a Lightning Address
   */
  @Get(':addressId/payments')
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
