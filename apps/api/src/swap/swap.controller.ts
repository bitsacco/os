import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { object } from 'joi';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Currency,
  mapToCurrency,
  type SupportedCurrencyType,
  SupportedCurrencies,
  CreateOnrampSwapDto,
  ListSwapsDto,
  CreateOfframpSwapDto,
  default_page,
  default_page_size,
  JwtAuthGuard,
  HandleServiceErrors,
} from '@bitsacco/common';
import { SwapService } from './swap.service';

@Controller('swap')
export class SwapController {
  private readonly logger = new Logger(SwapController.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly swapService: SwapService,
  ) {
    this.logger.log('SwapController initialized');
  }

  @Get('onramp/quote')
  @ApiOperation({ summary: 'Get onramp quote' })
  @ApiQuery({ name: 'currency', enum: SupportedCurrencies, required: true })
  @ApiQuery({ name: 'amount', type: Number, required: false })
  @HandleServiceErrors()
  async getOnrampQuote(
    @Query('currency') currency: SupportedCurrencyType,
    @Query('amount') amount?: number,
  ) {
    const from = mapToCurrency(currency);
    if (from !== Currency.KES) {
      const es = 'Invalid currency. Only KES is supported';
      this.logger.error(es);
      throw new BadRequestException(es);
    }

    return await this.swapService.getQuote({
      from,
      to: Currency.BTC,
      amount: amount?.toString(),
    });
  }

  @Post('onramp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Post onramp transaction' })
  @ApiBody({
    type: CreateOnrampSwapDto,
  })
  @HandleServiceErrors()
  async postOnrampTransaction(@Body() req: CreateOnrampSwapDto) {
    return await this.swapService.createOnrampSwap(req);
  }

  @Get('onramp/find/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Find onramp transaction by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Transaction ID' })
  @HandleServiceErrors()
  async findOnrampTransaction(@Param('id') id: string) {
    return await this.swapService.findOnrampSwap({ id });
  }

  @Get('onramp/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
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
  @HandleServiceErrors()
  async getOnrampTransactions(
    @Query('page') page: number = default_page,
    @Query('size') size: number = default_page_size,
  ) {
    return await this.swapService.listOnrampSwaps({
      page,
      size,
    });
  }

  @Get('offramp/quote')
  @ApiOperation({ summary: 'Get offramp quote' })
  @ApiQuery({ name: 'currency', enum: SupportedCurrencies, required: true })
  @ApiQuery({ name: 'amount', type: Number, required: false })
  @HandleServiceErrors()
  async getOfframpQuote(
    @Query('currency') currency: SupportedCurrencyType,
    @Query('amount') amount?: number,
  ) {
    const to = mapToCurrency(currency);
    if (to !== Currency.KES) {
      const es = 'Invalid currency. Only KES is supported';
      this.logger.error(es);
      throw new BadRequestException(es);
    }

    return await this.swapService.getQuote({
      to,
      from: Currency.BTC,
      amount: amount?.toString(),
    });
  }

  @Post('offramp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Post offramp transaction' })
  @ApiBody({
    type: CreateOfframpSwapDto,
  })
  @HandleServiceErrors()
  async postOfframpTransaction(@Body() req: CreateOfframpSwapDto) {
    return await this.swapService.createOfframpSwap(req);
  }

  @Get('offramp/find/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Find offramp transaction by ID' })
  @ApiParam({ name: 'id', type: 'string', description: 'Transaction ID' })
  @HandleServiceErrors()
  async findOfframpTransaction(@Param('id') id: string) {
    return await this.swapService.findOfframpSwap({ id });
  }

  @Get('offramp/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
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
  @HandleServiceErrors()
  async getOfframpTransactions(
    @Query('page') page: number = 0,
    @Query('size') size: number = 100,
  ) {
    return await this.swapService.listOfframpSwaps({
      page,
      size,
    });
  }

  @Post('webhook')
  @ApiOperation({
    summary:
      'Post updates to an active swap. Used as a webhook by 3rd parties to notify transaction progress',
  })
  @ApiBody({ type: object })
  async postSwapUpdate(@Body() updates: unknown) {
    // Process the update asynchronously without waiting
    this.swapService.processSwapUpdate(updates as any).catch((error) => {
      this.logger.error('Error processing swap update:', error);
    });

    // Immediately return success to the webhook caller
    return { success: true };
  }
}
