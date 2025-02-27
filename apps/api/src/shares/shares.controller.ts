import {
  default_page,
  default_page_size,
  JwtAuthGuard,
  OfferSharesDto,
  PaginatedRequestDto,
  SHARES_SERVICE_NAME,
  SharesServiceClient,
  SubscribeSharesDto,
  TransferSharesDto,
  UpdateSharesDto,
} from '@bitsacco/common';
import {
  Body,
  Controller,
  Get,
  Inject,
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
import { type ClientGrpc } from '@nestjs/microservices';

@Controller('shares')
@UseGuards(JwtAuthGuard)
export class SharesController {
  private sharesService: SharesServiceClient;
  private readonly logger = new Logger(SharesController.name);

  constructor(@Inject(SHARES_SERVICE_NAME) private readonly grpc: ClientGrpc) {
    this.sharesService =
      this.grpc.getService<SharesServiceClient>(SHARES_SERVICE_NAME);
    this.logger.log('SharesController initialized');
  }

  @Post('offer')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Offer Bitsacco shares' })
  @ApiBody({
    type: OfferSharesDto,
  })
  offerShares(@Body() req: OfferSharesDto) {
    return this.sharesService.offerShares(req);
  }

  @Get('offers')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List all share offers' })
  getShareOffers() {
    return this.sharesService.getSharesOffers({});
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Subscribe Bitsacco shares' })
  @ApiBody({
    type: SubscribeSharesDto,
  })
  subscribeShares(@Body() req: SubscribeSharesDto) {
    return this.sharesService.subscribeShares(req);
  }

  @Post('transfer')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Transfer Bitsacco shares' })
  @ApiBody({
    type: TransferSharesDto,
  })
  transferShares(@Body() req: TransferSharesDto) {
    return this.sharesService.transferShares(req);
  }

  @Post('update')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update Bitsacco shares' })
  @ApiBody({
    type: UpdateSharesDto,
  })
  updateShares(@Body() req: UpdateSharesDto) {
    return this.sharesService.updateShares(req);
  }

  @Get('transactions')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List all Bitsacco share transactions' })
  allSharesTransactions() {
    return this.sharesService.allSharesTransactions({});
  }

  @Get('transactions/:userId')
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
  userSharesTransactions(
    @Param('userId') userId: string,
    @Query('page') page: number = default_page,
    @Query('size') size: number = default_page_size,
  ) {
    return this.sharesService.userSharesTransactions({
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
  findSharesTransaction(@Param('sharesId') sharesId: string) {
    return this.sharesService.findSharesTransaction({
      sharesId,
    });
  }
}
