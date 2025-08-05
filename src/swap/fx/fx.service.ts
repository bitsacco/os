import { AxiosError } from 'axios';
import { firstValueFrom, catchError } from 'rxjs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  Currency,
  mapToSupportedCurrency,
  SupportedCurrencyType,
} from '../../common';

interface CurrencyApiResponse {
  meta: {
    last_updated_at: string;
  };
  data: {
    [currencyCode: string]: {
      code: string;
      value: number;
    };
  };
}

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.logger.log('FxService initialized');
  }

  async getExchangeRate(
    baseCurrency: SupportedCurrencyType,
    targetCurrency: SupportedCurrencyType,
  ): Promise<number> {
    const cacheKey = `${baseCurrency}-${targetCurrency}`;

    const cachedRate = await this.cacheManager
      .get<{
        btcToKesRate: string;
      }>(cacheKey)
      .catch(() => undefined);
    if (cachedRate) {
      this.logger.log('Returning cached currency rates');
      return cachedRate;
    }

    const env = this.configService.get('NODE_ENV');
    const api_key = this.configService.get('CURRENCY_API_KEY');
    const mock_rate = this.configService.get('MOCK_BTC_KES_RATE');

    if (!api_key) {
      if (mock_rate) {
        this.logger.log('Returning fake currency rates');
        return mock_rate;
      }

      if (env === 'production') {
        throw new Error('CURRENCY_API_KEY not found');
      }

      throw new Error(
        'Either CURRENCY_API_KEY or MOCK_BTC_KES_RATE must be configured',
      );
    }

    const response = await firstValueFrom(
      this.httpService
        .get(
          `https://api.currencyapi.com/v3/latest?apikey=${api_key}&base_currency=${baseCurrency}&currencies=${targetCurrency}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
        .pipe(
          catchError((error: AxiosError) => {
            throw error;
          }),
        ),
    );

    const { data }: CurrencyApiResponse = response.data;

    const rate = data[targetCurrency].value;
    this.logger.log(`1 ${baseCurrency} = ${rate} ${targetCurrency}`);

    await this.cacheManager.set(cacheKey, rate, this.CACHE_TTL);
    return rate;
  }

  async getInverseExchangeRate(
    baseCurrency: Currency,
    targetCurrency: Currency,
  ) {
    const rate = await this.getExchangeRate(
      mapToSupportedCurrency(baseCurrency),
      mapToSupportedCurrency(targetCurrency),
    );
    return 1 / rate;
  }
}
