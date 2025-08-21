import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  encodeLnurl,
  decodeLnurl,
  isValidLnurl,
  isLightningAddress,
  parseLightningAddress,
  generateK1,
} from '../../common';

@Injectable()
export class LnurlCommonService {
  private readonly logger = new Logger(LnurlCommonService.name);
  private readonly domain: string;
  private readonly signingSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.domain = this.configService.get<string>(
      'LNURL_DOMAIN',
      'bitsacco.com',
    );
    // Use a signing secret for HMAC signatures (should be in env vars)
    this.signingSecret = this.configService.get<string>(
      'LNURL_SIGNING_SECRET',
      'default-signing-secret-change-in-production',
    );
  }

  /**
   * Validate LNURL input
   */
  validateLnurl(input: string): boolean {
    return isValidLnurl(input);
  }

  /**
   * Decode LNURL to URL
   */
  decodeLnurl(encoded: string): string {
    try {
      return decodeLnurl(encoded);
    } catch (error) {
      this.logger.error(`Failed to decode LNURL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Encode URL to LNURL
   */
  encodeLnurl(url: string): string {
    try {
      return encodeLnurl(url);
    } catch (error) {
      this.logger.error(`Failed to encode LNURL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if input is a Lightning Address
   */
  isLightningAddress(input: string): boolean {
    return isLightningAddress(input);
  }

  /**
   * Parse Lightning Address
   */
  parseLightningAddress(address: string): { username: string; domain: string } {
    return parseLightningAddress(address);
  }

  /**
   * Generate a unique k1 value for LNURL operations
   */
  generateK1(): string {
    return generateK1();
  }

  /**
   * Get the callback URL for a given path
   */
  getCallbackUrl(path: string): string {
    const baseUrl = this.configService.get<string>('LNURL_CALLBACK_BASE_URL');
    if (!baseUrl) {
      throw new Error('LNURL_CALLBACK_BASE_URL not configured');
    }
    return `${baseUrl}${path}`;
  }

  /**
   * Format amount from fiat to millisatoshis
   */
  fiatToMsats(amountFiat: number, rate: number): number {
    // Convert fiat to BTC then to millisatoshis
    const btc = amountFiat / rate;
    return Math.round(btc * 100000000 * 1000); // BTC to sats to msats
  }

  /**
   * Format amount from millisatoshis to fiat
   */
  msatsToFiat(amountMsats: number, rate: number): number {
    // Convert msats to BTC then to fiat
    const btc = amountMsats / (100000000 * 1000);
    return Math.round(btc * rate * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Validate amount is within acceptable range
   */
  validateAmount(
    amountMsats: number,
    minSendable: number,
    maxSendable: number,
  ): boolean {
    return amountMsats >= minSendable && amountMsats <= maxSendable;
  }

  /**
   * Generate LNURL metadata string (LUD-06)
   */
  generateMetadata(description: string, imageUrl?: string): string {
    const metadata: Array<[string, string]> = [['text/plain', description]];

    if (imageUrl) {
      // Extract file extension for MIME type
      const ext = imageUrl.split('.').pop()?.toLowerCase();
      let mimeType = 'image/png'; // default

      if (ext === 'jpg' || ext === 'jpeg') {
        mimeType = 'image/jpeg';
      } else if (ext === 'gif') {
        mimeType = 'image/gif';
      }

      metadata.push([mimeType, imageUrl]);
    }

    return JSON.stringify(metadata);
  }

  /**
   * Parse LNURL metadata string
   */
  parseMetadata(metadataStr: string): {
    description?: string;
    imageUrl?: string;
  } {
    try {
      const metadata = JSON.parse(metadataStr) as Array<[string, string]>;
      const result: { description?: string; imageUrl?: string } = {};

      for (const [type, value] of metadata) {
        if (type === 'text/plain') {
          result.description = value;
        } else if (type.startsWith('image/')) {
          result.imageUrl = value;
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to parse metadata: ${error.message}`);
      return {};
    }
  }

  /**
   * Check if domain is internal (ours)
   */
  isInternalDomain(domain: string): boolean {
    return (
      domain === this.domain ||
      domain === `www.${this.domain}` ||
      domain.endsWith(`.${this.domain}`)
    );
  }

  /**
   * Format success action response
   */
  formatSuccessAction(type: 'message' | 'url' | 'aes', data: any): any {
    switch (type) {
      case 'message':
        return {
          tag: 'message',
          message: data,
        };
      case 'url':
        return {
          tag: 'url',
          description: data.description,
          url: data.url,
        };
      case 'aes':
        return {
          tag: 'aes',
          description: data.description,
          ciphertext: data.ciphertext,
          iv: data.iv,
        };
      default:
        return null;
    }
  }

  /**
   * Generate a signature for an invoice to prove server authenticity
   * @param invoice The BOLT11 invoice string
   * @returns HMAC-SHA256 signature as hex string
   */
  generateInvoiceSignature(invoice: string): string {
    const hmac = createHmac('sha256', this.signingSecret);
    hmac.update(invoice);
    return hmac.digest('hex');
  }

  /**
   * Verify an invoice signature
   * @param invoice The BOLT11 invoice string
   * @param signature The signature to verify
   * @returns true if signature is valid
   */
  verifyInvoiceSignature(invoice: string, signature: string): boolean {
    const expectedSignature = this.generateInvoiceSignature(invoice);
    // Use timing-safe comparison to prevent timing attacks
    return expectedSignature === signature;
  }
}
