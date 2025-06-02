import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { BusinessMetricsService } from '../../../infrastructure/monitoring/business-metrics.service';

// gRPC service interface (generated from proto)
interface SwapService {
  createSwap(data: CreateSwapRequest): Observable<SwapResponse>;
  getSwap(data: GetSwapRequest): Observable<SwapResponse>;
  listSwaps(data: ListSwapsRequest): Observable<ListSwapsResponse>;
  cancelSwap(data: CancelSwapRequest): Observable<SwapResponse>;
  getExchangeRate(data: ExchangeRateRequest): Observable<ExchangeRateResponse>;
}

// Request/Response types (should match proto definitions)
export interface CreateSwapRequest {
  userId: string;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  type: 'onramp' | 'offramp';
  phoneNumber?: string;
  walletAddress?: string;
}

export interface GetSwapRequest {
  swapId: string;
  userId: string;
}

export interface ListSwapsRequest {
  userId: string;
  page?: number;
  limit?: number;
  status?: string;
}

export interface CancelSwapRequest {
  swapId: string;
  userId: string;
  reason?: string;
}

export interface ExchangeRateRequest {
  fromCurrency: string;
  toCurrency: string;
  amount?: number;
}

export interface SwapResponse {
  success: boolean;
  swap?: any;
  error?: string;
}

export interface ListSwapsResponse {
  success: boolean;
  swaps: any[];
  total: number;
  page: number;
  limit: number;
}

export interface ExchangeRateResponse {
  success: boolean;
  rate: number;
  fromCurrency: string;
  toCurrency: string;
  timestamp: string;
}

@Injectable()
export class SwapServiceClient implements OnModuleInit {
  private readonly logger = new Logger(SwapServiceClient.name);
  private swapService: SwapService;

  constructor(
    @Inject('SWAP_SERVICE') private readonly client: ClientGrpc,
    private readonly metricsService: BusinessMetricsService,
  ) {}

  onModuleInit() {
    this.swapService = this.client.getService<SwapService>('SwapService');
    this.logger.log('Swap service client initialized');
  }

  async createSwap(request: CreateSwapRequest): Promise<SwapResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Creating swap', {
        userId: request.userId,
        type: request.type,
        fromCurrency: request.fromCurrency,
        toCurrency: request.toCurrency,
        amount: request.amount,
      });

      const response = await firstValueFrom(
        this.swapService.createSwap(request).pipe(
          timeout(10000), // 10 second timeout
          retry({ count: 2, delay: 1000 }), // Retry twice with 1s delay
          catchError((error) => {
            this.logger.error('Error creating swap', error);
            throw error;
          }),
        ),
      );

      const duration = Date.now() - startTime;
      await this.metricsService.recordOperationDuration(
        'swap.create',
        duration,
        response.success,
        {
          userId: request.userId,
          type: request.type,
          fromCurrency: request.fromCurrency,
          toCurrency: request.toCurrency,
        },
      );

      this.logger.log('Swap created successfully', {
        userId: request.userId,
        success: response.success,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.metricsService.recordOperationDuration(
        'swap.create',
        duration,
        false,
        {
          userId: request.userId,
          error: (error as Error).message,
        },
      );

      await this.metricsService.recordDomainError(
        'SwapService',
        'createSwap',
        error as Error,
        request.userId,
      );

      throw error;
    }
  }

  async getSwap(request: GetSwapRequest): Promise<SwapResponse> {
    const startTime = Date.now();

    try {
      const response = await firstValueFrom(
        this.swapService
          .getSwap(request)
          .pipe(timeout(5000), retry({ count: 1, delay: 500 })),
      );

      const duration = Date.now() - startTime;
      await this.metricsService.recordOperationDuration(
        'swap.get',
        duration,
        response.success,
        { userId: request.userId, swapId: request.swapId },
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.metricsService.recordOperationDuration(
        'swap.get',
        duration,
        false,
        { userId: request.userId, error: (error as Error).message },
      );

      throw error;
    }
  }

  async listSwaps(request: ListSwapsRequest): Promise<ListSwapsResponse> {
    const startTime = Date.now();

    try {
      const response = await firstValueFrom(
        this.swapService
          .listSwaps(request)
          .pipe(timeout(5000), retry({ count: 1, delay: 500 })),
      );

      const duration = Date.now() - startTime;
      await this.metricsService.recordOperationDuration(
        'swap.list',
        duration,
        response.success,
        { userId: request.userId },
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.metricsService.recordOperationDuration(
        'swap.list',
        duration,
        false,
        { userId: request.userId, error: (error as Error).message },
      );

      throw error;
    }
  }

  async getExchangeRate(
    request: ExchangeRateRequest,
  ): Promise<ExchangeRateResponse> {
    const startTime = Date.now();

    try {
      const response = await firstValueFrom(
        this.swapService
          .getExchangeRate(request)
          .pipe(timeout(3000), retry({ count: 2, delay: 500 })),
      );

      const duration = Date.now() - startTime;
      await this.metricsService.recordOperationDuration(
        'swap.exchangeRate',
        duration,
        response.success,
        {
          fromCurrency: request.fromCurrency,
          toCurrency: request.toCurrency,
        },
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.metricsService.recordOperationDuration(
        'swap.exchangeRate',
        duration,
        false,
        { error: (error as Error).message },
      );

      throw error;
    }
  }

  async cancelSwap(request: CancelSwapRequest): Promise<SwapResponse> {
    const startTime = Date.now();

    try {
      const response = await firstValueFrom(
        this.swapService
          .cancelSwap(request)
          .pipe(timeout(10000), retry({ count: 1, delay: 1000 })),
      );

      const duration = Date.now() - startTime;
      await this.metricsService.recordOperationDuration(
        'swap.cancel',
        duration,
        response.success,
        { userId: request.userId, swapId: request.swapId },
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.metricsService.recordOperationDuration(
        'swap.cancel',
        duration,
        false,
        { userId: request.userId, error: (error as Error).message },
      );

      throw error;
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      // Try to get exchange rates as a health check
      const response = await this.getExchangeRate({
        fromCurrency: 'BTC',
        toCurrency: 'KES',
        amount: 1,
      });

      return response.success;
    } catch (error) {
      this.logger.warn('Swap service health check failed', error);
      return false;
    }
  }
}
