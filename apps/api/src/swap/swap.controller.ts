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
  UseGuards,
} from '@nestjs/common';
import { object } from 'joi';
import { type ClientGrpc, ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
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
  process_swap_update,
  EVENTS_SERVICE_BUS,
  CreateOnrampSwapDto,
  ListSwapsDto,
  CreateOfframpSwapDto,
  default_page,
  default_page_size,
  SwapServiceClient,
  SWAP_SERVICE_NAME,
  JwtAuthGuard,
  HandleServiceErrors,
  CircuitBreakerService,
  TransactionStatus,
} from '@bitsacco/common';

@Controller('swap')
export class SwapController {
  private swapService: SwapServiceClient;
  private readonly logger = new Logger(SwapController.name);

  constructor(
    @Inject(SWAP_SERVICE_NAME) private readonly grpc: ClientGrpc,
    @Inject(EVENTS_SERVICE_BUS) private readonly eventsClient: ClientProxy,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    this.swapService =
      this.grpc.getService<SwapServiceClient>(SWAP_SERVICE_NAME);
    this.logger.log('SwapController initialized');
  }

  @Get('onramp/quote')
  @ApiOperation({ summary: 'Get onramp quote' })
  @ApiQuery({ name: 'currency', enum: SupportedCurrencies, required: true })
  @ApiQuery({ name: 'amount', type: Number, required: false })
  @HandleServiceErrors()
  getOnrampQuote(
    @Query('currency') currency: SupportedCurrencyType,
    @Query('amount') amount?: number,
  ): Observable<any> {
    const from = mapToCurrency(currency);
    if (from !== Currency.KES) {
      const es = 'Invalid currency. Only KES is supported';
      this.logger.error(es);
      throw new BadRequestException(es);
    }

    return this.circuitBreaker.execute(
      'swap-service-quote',
      this.swapService.getQuote({
        from,
        to: Currency.BTC,
        amount: amount?.toString(),
      }),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: {
          id: 'quote-fallback',
          from: Currency.KES,
          to: Currency.BTC,
          rate: '0',
          expiry: '0',
          amount: '0',
        },
      },
    );
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
  postOnrampTransaction(@Body() req: CreateOnrampSwapDto): Observable<any> {
    return this.circuitBreaker.execute(
      'swap-service-onramp',
      this.swapService.createOnrampSwap(req),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: {
          id: 'error-fallback',
          rate: '0',
          lightning: '',
          status: TransactionStatus.FAILED,
          retryCount: 0,
          createdAt: new Date().toISOString(),
          message: 'Swap service temporarily unavailable',
        },
      },
    );
  }

  @Get('onramp/find/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Find onramp transaction by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Transaction ID' })
  @HandleServiceErrors()
  findOnrampTransaction(@Param('id') id: string): Observable<any> {
    return this.circuitBreaker.execute(
      'swap-service-find',
      this.swapService.findOnrampSwap({ id }),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
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
  getOnrampTransactions(
    @Query('page') page: number = default_page,
    @Query('size') size: number = default_page_size,
  ): Observable<any> {
    return this.circuitBreaker.execute(
      'swap-service-list',
      this.swapService.listOnrampSwaps({
        page,
        size,
      }),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: {
          swaps: [],
          pages: 0,
          page,
          size,
        },
      },
    );
  }

  @Get('offramp/quote')
  @ApiOperation({ summary: 'Get onramp quote' })
  @ApiQuery({ name: 'currency', enum: SupportedCurrencies, required: true })
  @ApiQuery({ name: 'amount', type: Number, required: false })
  @HandleServiceErrors()
  getOfframpQuote(
    @Query('currency') currency: SupportedCurrencyType,
    @Query('amount') amount?: number,
  ): Observable<any> {
    const to = mapToCurrency(currency);
    if (to !== Currency.KES) {
      const es = 'Invalid currency. Only KES is supported';
      this.logger.error(es);
      throw new BadRequestException(es);
    }

    return this.circuitBreaker.execute(
      'swap-service-quote',
      this.swapService.getQuote({
        to,
        from: Currency.BTC,
        amount: amount?.toString(),
      }),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: {
          id: 'quote-fallback',
          from: Currency.BTC,
          to: Currency.KES,
          rate: '0',
          expiry: '0',
          amount: '0',
        },
      },
    );
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
  postOfframpTransaction(@Body() req: CreateOfframpSwapDto): Observable<any> {
    return this.circuitBreaker.execute(
      'swap-service-offramp',
      this.swapService.createOfframpSwap(req),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: {
          id: 'error-fallback',
          rate: '0',
          lightning: '',
          status: TransactionStatus.FAILED,
          retryCount: 0,
          createdAt: new Date().toISOString(),
          message: 'Swap service temporarily unavailable',
        },
      },
    );
  }

  @Get('offramp/find/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Find offramp transaction by ID' })
  @ApiParam({ name: 'id', type: 'string', description: 'Transaction ID' })
  findOfframpTransaction(@Param('id') id: string) {
    return this.swapService.findOfframpSwap({ id });
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
