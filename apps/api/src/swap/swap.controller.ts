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
import { object } from 'joi';
import { type ClientGrpc, ClientProxy } from '@nestjs/microservices';
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
  CreateOfframpSwapDto,
  default_page,
  default_page_size,
  SwapServiceClient,
  SWAP_SERVICE_NAME,
} from '@bitsacco/common';

@Controller('swap')
export class SwapController {
  private swapService: SwapServiceClient;
  private readonly logger = new Logger(SwapController.name);

  constructor(
    @Inject(SWAP_SERVICE_NAME) private readonly grpc: ClientGrpc,
    @Inject(EVENTS_SERVICE_BUS) private readonly eventsClient: ClientProxy,
  ) {
    this.swapService =
      this.grpc.getService<SwapServiceClient>(SWAP_SERVICE_NAME);
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

    return this.swapService.getQuote({
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
  postOnrampTransaction(@Body() req: CreateOnrampSwapDto) {
    return this.swapService.createOnrampSwap(req);
  }

  @Get('onramp/find/:id')
  @ApiOperation({ summary: 'Find onramp transaction by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Transaction ID' })
  findOnrampTransaction(@Param('id') id: string) {
    return this.swapService.findOnrampSwap({ id });
  }

  @Get('onramp/all')
  @ApiOperation({ summary: 'List onramp swaps' })
  @ApiQuery({
    name: 'page',
    example: '0',
    type: ListSwapsDto['page'],
    required: false,
  })
  @ApiQuery({
    name: 'size',
    example: '100',
    type: ListSwapsDto['size'],
    required: false,
  })
  getOnrampTransactions(
    @Query('page') page: number = default_page,
    @Query('size') size: number = default_page_size,
  ) {
    return this.swapService.listOnrampSwaps({
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

    return this.swapService.getQuote({
      to,
      from: Currency.BTC,
      amount: amount?.toString(),
    });
  }

  @Post('offramp')
  @ApiOperation({ summary: 'Post offramp transaction' })
  @ApiBody({
    type: CreateOfframpSwapDto,
  })
  postOfframpTransaction(@Body() req: CreateOfframpSwapDto) {
    return this.swapService.createOfframpSwap(req);
  }

  @Get('offramp/find/:id')
  @ApiOperation({ summary: 'Find offramp transaction by ID' })
  @ApiParam({ name: 'id', type: 'string', description: 'Transaction ID' })
  findOfframpTransaction(@Param('id') id: string) {
    return this.swapService.findOfframpSwap({ id });
  }

  @Get('offramp/all')
  @ApiOperation({ summary: 'List all offramp swaps' })
  @ApiQuery({
    name: 'page',
    example: '0',
    type: ListSwapsDto['page'],
    required: false,
  })
  @ApiQuery({
    name: 'size',
    example: '100',
    type: ListSwapsDto['size'],
    required: false,
  })
  getOfframpTransactions(
    @Query('page') page: number = 0,
    @Query('size') size: number = 100,
  ) {
    return this.swapService.listOfframpSwaps({
      page,
      size,
    });
  }

  @Post('webhook')
  @ApiOperation({
    summary:
      'Post updates to an acive swap. Used as a webhook by 3rd parties to notify transaction progress',
  })
  @ApiBody({ type: object })
  postSwapUpdate(@Body() updates: unknown) {
    this.eventsClient.emit(process_swap_update, updates);
    return { success: true };
  }
}
