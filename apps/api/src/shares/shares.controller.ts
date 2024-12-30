import {
  OfferSharesDto,
  SubscribeSharesDto,
  TransferSharesDto,
} from '@bitsacco/common';
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { SharesService } from './shares.service';

@Controller('shares')
export class SharesController {
  private readonly logger = new Logger(SharesController.name);

  constructor(private readonly sharesService: SharesService) {
    this.logger.log('SharesController initialized');
  }

  @Post('offer')
  @ApiOperation({ summary: 'Offer Bitsacco shares' })
  @ApiBody({
    type: OfferSharesDto,
  })
  offerShares(@Body() req: OfferSharesDto) {
    return this.sharesService.offerShares(req);
  }

  @Get('offers')
  @ApiOperation({ summary: 'List all share offers' })
  getShareOffers() {
    return this.sharesService.getSharesOffers({});
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe Bitsacco shares' })
  @ApiBody({
    type: SubscribeSharesDto,
  })
  subscribeShares(@Body() req: SubscribeSharesDto) {
    return this.sharesService.subscribeShares(req);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfer Bitsacco shares' })
  @ApiBody({
    type: TransferSharesDto,
  })
  transferShares(@Body() req: TransferSharesDto) {
    return this.sharesService.transferShares(req);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List all Bitsacco share transactions' })
  allSharesTransactions() {
    return this.sharesService.allSharesTransactions({});
  }

  @Get('transactions/:userId')
  @ApiOperation({
    summary: 'List all Bitsacco share transactions for user with given ID',
  })
  @ApiParam({ name: 'userId', type: 'string', description: 'User ID' })
  userSharesTransactions(@Param('userId') userId: string) {
    return this.sharesService.userSharesTransactions({
      userId,
    });
  }
}
