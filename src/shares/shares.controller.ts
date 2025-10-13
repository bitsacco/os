import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Patch,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  ResourceOwnerGuard,
  CheckOwnership,
  HandleServiceErrors,
  CurrentUser,
  type User,
} from '../common';
import {
  OfferSharesDto,
  SubscribeSharesDto,
  TransferSharesDto,
  UpdateSharesDto,
  UpdateShareOfferDto,
} from '../common/dto/shares.dto';
import { SharesService } from './shares.service';

@ApiTags('shares')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiCookieAuth()
export class SharesController {
  private readonly logger = new Logger(SharesController.name);

  constructor(private readonly sharesService: SharesService) {
    this.logger.log('SharesController initialized - REST-compliant endpoints');
  }

  /**
   * Create a share offer
   * POST /shares/offers
   */
  @Post('shares/offers')
  @ApiOperation({
    summary: 'Create a share offer',
    description: 'REST-compliant endpoint for creating share offers.',
  })
  @ApiBody({ type: OfferSharesDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Share offer created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  @HandleServiceErrors()
  async createShareOffer(
    @Body() offerSharesDto: OfferSharesDto,
    @CurrentUser() user: User,
  ) {
    this.logger.log(`Creating share offer by user ${user.id}`);

    // The offer creator is derived from authenticated user
    return await this.sharesService.offerShares(offerSharesDto);
  }

  /**
   * Update a share offer
   * PATCH /shares/offers/:offerId
   */
  @Patch('shares/offers/:offerId')
  @ApiOperation({
    summary: 'Update a share offer',
    description: 'REST-compliant endpoint for updating share offers.',
  })
  @ApiParam({
    name: 'offerId',
    description: 'The ID of the offer to update',
    type: 'string',
  })
  @ApiBody({ type: UpdateShareOfferDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Share offer updated successfully',
  })
  @HandleServiceErrors()
  async updateShareOffer(
    @Param('offerId') offerId: string,
    @Body() updateShareOfferDto: UpdateShareOfferDto,
  ) {
    this.logger.log(`Updating share offer ${offerId}`);

    return await this.sharesService.updateShareOffer({
      offerId: offerId,
      updates: updateShareOfferDto.updates,
    });
  }

  /**
   * Get all share offers
   * GET /shares/offers
   */
  @Get('shares/offers')
  @ApiOperation({
    summary: 'Get all share offers',
    description: 'REST-compliant endpoint for retrieving all share offers.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Share offers retrieved successfully',
  })
  @HandleServiceErrors()
  async getShareOffers() {
    this.logger.log('Getting all share offers');
    return await this.sharesService.getSharesOffers();
  }

  /**
   * Get a specific share offer
   * GET /shares/offers/:offerId
   */
  @Get('shares/offers/:offerId')
  @ApiOperation({
    summary: 'Get a specific share offer',
    description:
      'REST-compliant endpoint for retrieving a specific share offer.',
  })
  @ApiParam({
    name: 'offerId',
    description: 'The ID of the offer',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Share offer retrieved successfully',
  })
  @HandleServiceErrors()
  async getShareOffer(@Param('offerId') offerId: string) {
    this.logger.log(`Getting share offer ${offerId}`);
    const allOffers = await this.sharesService.getSharesOffers();
    const offer = allOffers.offers.find((o) => o.id === offerId);
    if (!offer) {
      throw new NotFoundException(`Share offer ${offerId} not found`);
    }
    return offer;
  }

  /**
   * Create shares for a user
   * POST /users/:userId/shares
   */
  @Post('users/:userId/shares')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Create shares for a user',
    description:
      'REST-compliant endpoint for creating shares. User ID is in the URL path.',
  })
  @ApiParam({
    name: 'userId',
    description: 'The ID of the user to create shares for',
    type: 'string',
  })
  @ApiBody({ type: OfferSharesDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Shares created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  @HandleServiceErrors()
  async createShares(
    @Param('userId') userId: string,
    @Body() offerSharesDto: OfferSharesDto,
  ) {
    this.logger.log(`Creating shares for user ${userId}`);

    const offerSharesRequest = {
      quantity: offerSharesDto.quantity,
      availableFrom: offerSharesDto.availableFrom,
      availableTo: offerSharesDto.availableTo,
    };
    return await this.sharesService.offerShares(offerSharesRequest);
  }

  /**
   * Update share details
   * PATCH /shares/:shareId
   */
  @Patch('shares/:shareId')
  @ApiOperation({
    summary: 'Update share details',
    description:
      'REST-compliant endpoint for updating shares. Share ID is in the URL path.',
  })
  @ApiParam({
    name: 'shareId',
    description: 'The ID of the share to update',
    type: 'string',
  })
  @ApiBody({ type: UpdateSharesDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Share updated successfully',
  })
  @HandleServiceErrors()
  async updateShare(
    @Param('shareId') shareId: string,
    @Body() updateSharesDto: UpdateSharesDto,
    @CurrentUser() user: User,
  ) {
    this.logger.log(`Updating share ${shareId}`);

    const updates = updateSharesDto.updates;
    const convertedUpdates = {
      ...updates,
      // If there's a transfer, add fromUserId from current user
      ...(updates.transfer && {
        transfer: {
          ...updates.transfer,
          fromUserId: user.id,
        },
      }),
    };

    return await this.sharesService.updateShares({
      sharesId: shareId,
      updates: convertedUpdates,
    });
  }

  /**
   * Transfer shares between users
   * POST /shares/:shareId/transfer
   */
  @Post('shares/:shareId/transfer')
  @ApiOperation({
    summary: 'Transfer shares between users',
    description:
      'REST-compliant endpoint for transferring shares. Share ID is in the URL path.',
  })
  @ApiParam({
    name: 'shareId',
    description: 'The ID of the share to transfer',
    type: 'string',
  })
  @ApiBody({ type: TransferSharesDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Shares transferred successfully',
  })
  @HandleServiceErrors()
  async transferShares(
    @Param('shareId') shareId: string,
    @Body() transferSharesDto: TransferSharesDto,
    @CurrentUser() user: User,
  ) {
    this.logger.log(`Transferring share ${shareId} from user ${user.id}`);

    return await this.sharesService.transferShares({
      sharesId: shareId,
      fromUserId: user.id,
      toUserId: transferSharesDto.toUserId,
      quantity: transferSharesDto.quantity,
    });
  }

  /**
   * Subscribe to shares
   * POST /users/:userId/offers/:offerId/subscribe
   */
  @Post('users/:userId/offers/:offerId/subscribe')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Subscribe to shares',
    description:
      'REST-compliant endpoint for subscribing to shares. Both user ID and offer ID are in the URL path.',
  })
  @ApiParam({
    name: 'userId',
    description: 'The ID of the user subscribing to shares',
    type: 'string',
  })
  @ApiParam({
    name: 'offerId',
    description: 'The ID of the offer to subscribe to',
    type: 'string',
  })
  @ApiBody({ type: SubscribeSharesDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Subscription created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  @HandleServiceErrors()
  async subscribeToShares(
    @Param('userId') userId: string,
    @Param('offerId') offerId: string,
    @Body() subscribeSharesDto: SubscribeSharesDto,
  ) {
    this.logger.log(`User ${userId} subscribing to offer ${offerId}`);

    return await this.sharesService.subscribeShares({
      userId: userId,
      offerId: offerId,
      quantity: subscribeSharesDto.quantity,
    });
  }

  /**
   * Get shares for a user
   * GET /users/:userId/shares
   */
  @Get('users/:userId/shares')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Get all shares for a user',
    description: 'REST-compliant endpoint for retrieving user shares.',
  })
  @ApiParam({
    name: 'userId',
    description: 'The ID of the user',
    type: 'string',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    type: 'number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
    type: 'number',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User shares retrieved successfully',
  })
  @HandleServiceErrors()
  async getUserShares(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    this.logger.log(`Getting shares for user ${userId}`);

    // This would call a method to get shares for a specific user
    return await this.sharesService.getUserSharesTxs(
      userId,
      page || 1,
      limit || 10,
    );
  }

  /**
   * Get a specific share
   * GET /shares/:shareId
   */
  @Get('shares/:shareId')
  @ApiOperation({
    summary: 'Get share details',
    description: 'REST-compliant endpoint for retrieving a specific share.',
  })
  @ApiParam({
    name: 'shareId',
    description: 'The ID of the share',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Share details retrieved successfully',
  })
  @HandleServiceErrors()
  async getShare(@Param('shareId') shareId: string) {
    this.logger.log(`Getting share ${shareId}`);

    // This would call a method to get a specific share
    // For now, we'll use the existing service method
    return await this.sharesService.getShareDetails(shareId);
  }
}
