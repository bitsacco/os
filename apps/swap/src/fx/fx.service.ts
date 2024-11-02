import { AxiosError } from 'axios';
import { firstValueFrom, catchError } from 'rxjs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CustomStore } from '@bitsacco/common';

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
  private readonly CACHE_KEY = 'currency_api_rates';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: CustomStore,
  ) {
    this.logger.log('FxService initialized');
  }

  private async getCurrencyApiRates() {
    const cachedData = await this.cacheManager.get<{
      btcToKesRate: string;
    } | void>(this.CACHE_KEY);
    if (cachedData) {
      this.logger.log('Returning cached currency rates');
      return cachedData;
    }

    const env = this.configService.get('NODE_ENV');
    const api_key = this.configService.get('CURRENCY_API_KEY');
    const mock_rate = this.configService.get('MOCK_BTC_KES_RATE');

    if (!api_key) {
      if (mock_rate) {
        this.logger.log('Returning fake currency rates');
        return { btcToKesRate: mock_rate };
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
          `https://api.currencyapi.com/v3/latest?apikey=${api_key}&base_currency=BTC&currencies=KES`,
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

    const btcToKesRate = data.KES.value;
    this.logger.log(`1 BTC = ${btcToKesRate} KES`);

    const result = { btcToKesRate };
    await this.cacheManager.set(this.CACHE_KEY, result, this.CACHE_TTL);
    return result;
  }

  async getBtcToKesRate() {
    const { btcToKesRate } = await this.getCurrencyApiRates();
    return btcToKesRate;
  }
}
