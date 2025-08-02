import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  HttpException,
  Inject,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { isLightningAddress, isLnurl, isBech32 } from '../../common';
import { LnurlCommonService } from './lnurl-common.service';

export interface ResolvedLnurl {
  type: 'pay' | 'withdraw' | 'channel' | 'auth';
  domain: string;
  metadata: any;
  raw: any;
}

export interface LnurlPayMetadata {
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadata: string;
  tag: string;
  commentAllowed?: number;
  payerData?: any;
  nostrPubkey?: string;
  allowsNostr?: boolean;
  successAction?: any;
}

@Injectable()
export class LnurlResolverService {
  private readonly logger = new Logger(LnurlResolverService.name);
  private readonly defaultTimeout = 10000; // 10 seconds
  private readonly maxRedirects = 3;
  private readonly CACHE_TTL = 300000; // 5 minutes in milliseconds

  constructor(
    private readonly lnurlCommonService: LnurlCommonService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Resolve any LNURL input (Lightning Address, LNURL string, or URL)
   */
  async resolve(input: string): Promise<ResolvedLnurl> {
    this.logger.log(`Resolving LNURL input: ${input}`);

    // Check if it's a Lightning Address
    if (isLightningAddress(input)) {
      return this.resolveLightningAddressToLnurl(input);
    }

    // Check if it's a bech32-encoded LNURL
    if (isLnurl(input) && isBech32(input)) {
      const url = this.lnurlCommonService.decodeLnurl(input);
      return this.resolveUrl(url);
    }

    // Check if it's a plain URL
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return this.resolveUrl(input);
    }

    throw new BadRequestException('Invalid LNURL input format');
  }

  /**
   * Resolve a Lightning Address to LNURL metadata
   */
  async resolveLightningAddress(address: string): Promise<LnurlPayMetadata> {
    this.logger.log(`Resolving Lightning Address: ${address}`);

    if (!isLightningAddress(address)) {
      throw new BadRequestException('Invalid Lightning Address format');
    }

    const [username, domain] = address.split('@');

    // TODO: Validate domains

    // Construct the well-known URL
    const url = `https://${domain}/.well-known/lnurlp/${username}`;

    try {
      const metadata = await this.fetchExternalMetadata(url);

      // Validate LNURL-pay response
      if (!this.isValidLnurlPayResponse(metadata)) {
        throw new BadRequestException(
          'Invalid LNURL-pay response from external service',
        );
      }

      return metadata as LnurlPayMetadata;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to resolve Lightning Address ${address}: ${error.message}`,
      );
      throw new NotFoundException(
        `Lightning Address ${address} not found or unreachable`,
      );
    }
  }

  /**
   * Fetch external metadata with caching
   */
  async fetchExternalMetadata(
    url: string,
    options?: {
      timeout?: number;
      cacheTtl?: number;
    },
  ): Promise<any> {
    this.logger.log(`Fetching external metadata from: ${url}`);

    // Check cache first
    const cacheKey = `lnurl-metadata:${url}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) {
      this.logger.log(`Returning cached metadata for: ${url}`);
      return cached;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: options?.timeout || this.defaultTimeout,
          maxRedirects: this.maxRedirects,
          validateStatus: (status) => status >= 200 && status < 300,
          headers: {
            'User-Agent': 'Bitsacco-LNURL/1.0',
            Accept: 'application/json',
          },
        }),
      );

      const metadata = response.data;

      // Cache the response
      const cacheTtl = options?.cacheTtl || this.CACHE_TTL;
      await this.cacheManager.set(cacheKey, metadata, cacheTtl);

      return metadata;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const message =
          error.response.data?.reason || error.response.statusText;

        if (status === 404) {
          throw new NotFoundException(`External service not found: ${message}`);
        } else if (status >= 400 && status < 500) {
          throw new BadRequestException(`External service error: ${message}`);
        } else {
          throw new HttpException(
            `External service error: ${message}`,
            status || 500,
          );
        }
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new HttpException('External service timeout', 408);
      }

      throw new HttpException('Failed to connect to external service', 503);
    }
  }

  /**
   * Resolve a Lightning Address to full LNURL info
   */
  private async resolveLightningAddressToLnurl(
    address: string,
  ): Promise<ResolvedLnurl> {
    const metadata = await this.resolveLightningAddress(address);
    const [, domain] = address.split('@');

    return {
      type: 'pay',
      domain,
      metadata,
      raw: metadata,
    };
  }

  /**
   * Resolve a URL to LNURL info
   */
  private async resolveUrl(url: string): Promise<ResolvedLnurl> {
    const metadata = await this.fetchExternalMetadata(url);
    const domain = new URL(url).hostname;

    // Determine LNURL type from response
    const type = this.determineLnurlType(metadata);

    return {
      type,
      domain,
      metadata,
      raw: metadata,
    };
  }

  /**
   * Determine LNURL type from metadata
   */
  private determineLnurlType(
    metadata: any,
  ): 'pay' | 'withdraw' | 'channel' | 'auth' {
    if (metadata.tag === 'payRequest') {
      return 'pay';
    } else if (metadata.tag === 'withdrawRequest') {
      return 'withdraw';
    } else if (metadata.tag === 'channelRequest') {
      return 'channel';
    } else if (metadata.tag === 'login') {
      return 'auth';
    }

    throw new BadRequestException('Unknown LNURL type');
  }

  /**
   * Validate LNURL-pay response
   */
  private isValidLnurlPayResponse(response: any): boolean {
    return (
      response &&
      typeof response.callback === 'string' &&
      typeof response.minSendable === 'number' &&
      typeof response.maxSendable === 'number' &&
      typeof response.metadata === 'string' &&
      response.tag === 'payRequest'
    );
  }
}
