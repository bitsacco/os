import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBody, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import {
  Currency,
  mapToCurrency,
  type SupportedCurrencyType,
  SupportedCurrencies,
  process_swap_update,
  EVENTS_SERVICE_BUS,
  CreateOnrampSwapDto,
  ListSwapsDto,
} from '@bitsacco/common';
import { SwapService } from './swap.service';

@Controller('swap')
export class SwapController {
  private readonly logger = new Logger(SwapController.name);

  constructor(
    private readonly swapService: SwapService,
    @Inject(EVENTS_SERVICE_BUS) private readonly eventsClient: ClientProxy,
  ) {
    this.logger.log('SwapController initialized');
  }

  @Get('onramp/quote')
  @ApiOperation({ summary: 'Get onramp quote' })
  @ApiQuery({ name: 'currency', enum: SupportedCurrencies, required: true })
  @ApiQuery({ name: 'amount', type: Number, required: false })
  getOnrampQuote(
    @Query('currency') currency: SupportedCurrencyType,
    @Query('amount') amount?: number,
  ) {
    const from = mapToCurrency(currency);
    if (from !== Currency.KES) {
      const es = 'Invalid currency. Only KES is supported';
      this.logger.error(es);
      throw new BadRequestException(es);
    }

    return this.swapService.getOnrampQuote({
      from,
      to: Currency.BTC,
      amount: amount?.toString(),
    });
  }

  @Post('onramp')
  @ApiOperation({ summary: 'Post onramp transaction' })
  @ApiBody({
    type: CreateOnrampSwapDto,
  })
  postOnrampTransaction(
    @Body() { quote, ref, amount, phone, lightning }: CreateOnrampSwapDto,
  ) {
    return this.swapService.postOnrampTransaction({
      quote,
      ref,
      amount,
      phone,
      lightning,
    });
  }

  @Get('onramp/find/:id')
  @ApiOperation({ summary: 'Find onramp transaction by ID' })
  @ApiParam({ name: 'id', type: 'string', description: 'Transaction ID' })
  findOnrampTransaction(@Param('id') id: string) {
    return this.swapService.findOnrampTransaction({ id });
  }

  @Get('onramp/all')
  @ApiOperation({ summary: 'List onramp swaps' })
  @ApiQuery({
    name: 'page',
    example: '?page=0',
    type: ListSwapsDto['page'],
    required: false,
  })
  @ApiQuery({
    name: 'size',
    example: '?size=100',
    type: ListSwapsDto['size'],
    required: false,
  })
  getOnrampTransactions(
    @Query('page') page: number = 0,
    @Query('size') size: number = 100,
  ) {
    return this.swapService.getOnrampTransactions({
      page,
      size,
    });
  }

  @Get('offramp/quote')
  @ApiOperation({ summary: 'Get onramp quote' })
  @ApiQuery({ name: 'currency', enum: SupportedCurrencies, required: true })
  @ApiQuery({ name: 'amount', type: Number, required: false })
  getOfframpQuote(
    @Query('currency') currency: SupportedCurrencyType,
    @Query('amount') amount?: number,
  ) {
    const to = mapToCurrency(currency);
    if (to !== Currency.KES) {
      const es = 'Invalid currency. Only KES is supported';
      this.logger.error(es);
      throw new BadRequestException(es);
    }

    return this.swapService.getOfframpQuote({
      to,
      from: Currency.BTC,
      amount: amount?.toString(),
    });
  }

  @Post('offramp')
  postOfframpTransaction() {
    return this.swapService.postOfframpTransaction();
  }

  @Get('offramp/all')
  getOfframpTransactions() {
    return this.swapService.getOfframpTransactions();
  }

  @Get('offramp/find/:id')
  findOfframpTransaction() {
    return this.swapService.findOfframpTransaction();
  }

  @Post('webhook')
  @ApiOperation({
    summary:
      'Post updates to an acive swap. Used as a webhook by 3rd parties to notify transaction progress',
  })
  @ApiBody({})
  postSwapUpdate(@Body() updates: any) {
    this.eventsClient.emit(process_swap_update, updates);
    return { success: true };
  }
}
