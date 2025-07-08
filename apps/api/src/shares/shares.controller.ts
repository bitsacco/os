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
  ResourceOwnerGuard,
  CheckOwnership,
  CircuitBreakerService,
  HandleServiceErrors,
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

  constructor(
    @Inject(SHARES_SERVICE_NAME) private readonly grpc: ClientGrpc,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    this.sharesService =
      this.grpc.getService<SharesServiceClient>(SHARES_SERVICE_NAME);
    this.logger.log('SharesController initialized');
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
  offerShares(@Body() req: OfferSharesDto) {
    return this.circuitBreaker.execute(
      'shares-service-offer',
      this.sharesService.offerShares(req),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
  }

  @Get('offers')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List all share offers' })
  @HandleServiceErrors()
  getShareOffers() {
    return this.circuitBreaker.execute(
      'shares-service-offers',
      this.sharesService.getSharesOffers({}),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: {
          offers: [],
          totalOfferQuantity: 0,
          totalSubscribedQuantity: 0,
        },
      },
    );
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
  subscribeShares(@Body() req: SubscribeSharesDto) {
    return this.circuitBreaker.execute(
      'shares-service-subscribe',
      this.sharesService.subscribeShares(req),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
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
  transferShares(@Body() req: TransferSharesDto) {
    return this.circuitBreaker.execute(
      'shares-service-transfer',
      this.sharesService.transferShares(req),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
  }

  @Post('update')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update Bitsacco shares' })
  @ApiBody({
    type: UpdateSharesDto,
  })
  @HandleServiceErrors()
  updateShares(@Body() req: UpdateSharesDto) {
    return this.circuitBreaker.execute(
      'shares-service-update',
      this.sharesService.updateShares(req),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
  }

  @Get('transactions')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List all Bitsacco share transactions' })
  @HandleServiceErrors()
  allSharesTransactions() {
    return this.circuitBreaker.execute(
      'shares-service-all-transactions',
      this.sharesService.allSharesTransactions({}),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: {
          shares: { transactions: [], page: 0, size: 0, pages: 0 },
          offers: {
            offers: [],
            totalOfferQuantity: 0,
            totalSubscribedQuantity: 0,
          },
        },
      },
    );
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
  userSharesTransactions(
    @Param('userId') userId: string,
    @Query('page') page: number = default_page,
    @Query('size') size: number = default_page_size,
  ) {
    return this.circuitBreaker.execute(
      'shares-service-user-transactions',
      this.sharesService.userSharesTransactions({
        userId,
        pagination: {
          page,
          size,
        },
      }),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: {
          userId: '',
          shareHoldings: 0,
          shares: { transactions: [], page, size, pages: 0 },
          offers: {
            offers: [],
            totalOfferQuantity: 0,
            totalSubscribedQuantity: 0,
          },
        },
      },
    );
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
  findSharesTransaction(@Param('sharesId') sharesId: string) {
    return this.circuitBreaker.execute(
      'shares-service-find-transaction',
      this.sharesService.findSharesTransaction({
        sharesId,
      }),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
  }
}
