import {
  default_page,
  default_page_size,
  JwtAuthGuard,
  OfferSharesDto,
  PaginatedRequestDto,
  SubscribeSharesDto,
  TransferSharesDto,
  UpdateSharesDto,
  ResourceOwnerGuard,
  CheckOwnership,
  HandleServiceErrors,
  AllSharesOffers,
  AllSharesTxsResponse,
  UserShareTxsResponse,
  SharesTx,
} from '@bitsacco/common';
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { SharesService } from './shares.service';

@Controller('shares')
@UseGuards(JwtAuthGuard)
export class SharesController {
  private readonly logger = new Logger(SharesController.name);

  constructor(
    private readonly sharesService: SharesService,
  ) {
    this.logger.log('SharesController initialized with direct service injection');
  }

  @Post('offer')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Offer Bitsacco shares' })
  @ApiBody({
    type: OfferSharesDto,
  })
  @HandleServiceErrors()
  async offerShares(@Body() req: OfferSharesDto): Promise<AllSharesOffers> {
    return await this.sharesService.offerShares(req);
  }

  @Get('offers')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List all share offers' })
  @HandleServiceErrors()
  async getShareOffers(): Promise<AllSharesOffers> {
    return await this.sharesService.getSharesOffers();
  }

  @Post('subscribe')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Subscribe Bitsacco shares' })
  @ApiBody({
    type: SubscribeSharesDto,
  })
  @HandleServiceErrors()
  async subscribeShares(@Body() req: SubscribeSharesDto): Promise<UserShareTxsResponse> {
    return await this.sharesService.subscribeShares(req);
  }

  @Post('transfer')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Transfer Bitsacco shares' })
  @ApiBody({
    type: TransferSharesDto,
  })
  @HandleServiceErrors()
  async transferShares(@Body() req: TransferSharesDto): Promise<UserShareTxsResponse> {
    return await this.sharesService.transferShares(req);
  }

  @Post('update')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update Bitsacco shares' })
  @ApiBody({
    type: UpdateSharesDto,
  })
  @HandleServiceErrors()
  async updateShares(@Body() req: UpdateSharesDto): Promise<UserShareTxsResponse> {
    return await this.sharesService.updateShares(req);
  }

  @Get('transactions')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List all Bitsacco share transactions' })
  @HandleServiceErrors()
  async allSharesTransactions(): Promise<AllSharesTxsResponse> {
    return await this.sharesService.allSharesTransactions();
  }

  @Get('transactions/:userId')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'List all Bitsacco share transactions for user with given ID',
  })
  @ApiParam({ name: 'userId', type: 'string', description: 'User ID' })
  @ApiQuery({
    name: 'page',
    example: '0',
    type: PaginatedRequestDto['page'],
    required: false,
  })
  @ApiQuery({
    name: 'size',
    example: '100',
    type: PaginatedRequestDto['size'],
    required: false,
  })
  @HandleServiceErrors()
  async userSharesTransactions(
    @Param('userId') userId: string,
    @Query('page') page: number = default_page,
    @Query('size') size: number = default_page_size,
  ): Promise<UserShareTxsResponse> {
    return await this.sharesService.userSharesTransactions({
      userId,
      pagination: {
        page,
        size,
      },
    });
  }

  @Get('transactions/find/:sharesId')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Find Bitsacco shares transaction with given ID',
  })
  @ApiParam({
    name: 'sharesId',
    type: 'string',
    description: 'Share Transaction ID',
  })
  @HandleServiceErrors()
  async findSharesTransaction(@Param('sharesId') sharesId: string): Promise<SharesTx> {
    return await this.sharesService.findSharesTransaction({
      sharesId,
    });
  }
}
