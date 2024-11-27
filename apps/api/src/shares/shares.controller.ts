import { BuySharesDto, GetShareDetailDto } from '@bitsacco/common';
import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { SharesService } from './shares.service';

@Controller('shares')
export class SharesController {
  private readonly logger = new Logger(SharesController.name);

  constructor(private readonly sharesService: SharesService) {
    this.logger.log('SharesController initialized');
  }

  @Get('detail')
  @ApiOperation({ summary: 'Get share details' })
  @ApiQuery({ name: 'user', type: String, required: true })
  getShareDetail(@Query('user') user: string) {
    return this.sharesService.getShareDetail({ userId: user });
  }

  @Post('buy')
  @ApiOperation({ summary: 'Buy Bitsacco shares' })
  @ApiBody({
    type: BuySharesDto,
  })
  buyShares(@Body() req: BuySharesDto) {
    return this.sharesService.buyShares(req);
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Show Bitsacco share subscription levels' })
  getShareSubscription() {
    return this.sharesService.getShareSubscription({});
  }
}

// @ApiQuery({ name: 'currency', enum: SupportedCurrencies, required: true })
//   @ApiQuery({ name: 'amount', type: Number, required: false })
//   getOnrampQuote(
//     @Query('currency') currency: SupportedCurrencyType,
//     @Query('amount') amount?: number,
//   ) {
