import { bech32 } from 'bech32';
import * as crypto from 'crypto';
import { AxiosError } from 'axios';
import { decode } from 'light-bolt11-decoder';
import { catchError, firstValueFrom, map } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  fedimint_receive_success,
  fedimint_receive_failure,
  FedimintContext,
} from '../events';
import {
  LightningInvoiceResponse,
  LightningPayResponse,
  LnUrlWithdrawPoint,
  WithFederationId,
  WithGatewayId,
} from '../types';

@Injectable()
export class FedimintService {
  private readonly logger = new Logger(FedimintService.name);

  private baseUrl: string;
  private password: string;
  private federationId: string;
  private gatewayId: string;
  private lnUrlCallback: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('FedimintService created');
  }

  initialize(
    baseUrl: string,
    federationId: string,
    gatewayId: string,
    password: string,
    lnUrlCallback?: string,
  ) {
    this.baseUrl = baseUrl;
    this.federationId = federationId;
    this.gatewayId = gatewayId;
    this.password = password;
    if (lnUrlCallback) {
      this.lnUrlCallback = lnUrlCallback;
    }
    this.logger.log('FedimintService initialized');
  }

  private async post<S, T>(endpoint: string, data: S): Promise<T> {
    const url = `${this.baseUrl}/v2${endpoint}`;
    this.logger.log(`POST ${url} : ${JSON.stringify(data)}`);

    return firstValueFrom(
      this.httpService
        .post<T>(url, data, {
          headers: {
            Authorization: `Bearer ${this.password}`,
            'Content-Type': 'application/json',
          },
        })
        .pipe(map((resp) => resp.data))
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(error);
            throw error;
          }),
        ),
    );
  }

  async invoice(
    amountMsat: number,
    description: string,
  ): Promise<{
    invoice: string;
    operationId: string;
  }> {
    this.logger.log(
      `Generating invoice for amount: ${amountMsat} msats (fees implicitly included)`,
    );

    const FEE_LIMIT_PERCENTAGE = 0.01; // 1% max for fees
    const { invoice, operationId }: LightningInvoiceResponse = await this.post<
      {
        amountMsat: number;
        description: string;
        extra_meta: object;
      } & WithFederationId &
        WithGatewayId,
      LightningInvoiceResponse
    >('/ln/invoice', {
      amountMsat,
      description,
      federationId: this.federationId,
      gatewayId: this.gatewayId,
      extra_meta: {
        feeLimit: Math.round(amountMsat * FEE_LIMIT_PERCENTAGE),
      },
    });

    this.logger.log('Invoice : ', invoice);
    return {
      invoice,
      operationId,
    };
  }

  async decode(invoice: string): Promise<FlatDecodedInvoice> {
    try {
      const decodedInvoice = decode(invoice);
      // this.logger.log(decodedInvoice);

      return {
        paymentHash: decodedInvoice.sections.find(
          (s) => s.name === 'payment_hash',
        )?.value,
        amountMsats: decodedInvoice.sections.find((s) => s.name === 'amount')
          ?.value,
        description: decodedInvoice.sections.find(
          (s) => s.name === 'description',
        )?.value,
        timestamp: decodedInvoice.sections.find((s) => s.name === 'timestamp')
          ?.value,
      };
    } catch (error) {
      console.error('Error decoding invoice:', error);
      throw new Error('Failed to decode invoice');
    }
  }

  async pay(invoice: string): Promise<{ operationId: string; fee: number }> {
    this.logger.log(`Paying Invoice : ${invoice}`);

    const res = await this.post<
      { paymentInfo: string } & WithFederationId & WithGatewayId,
      unknown
    >('/ln/pay', {
      paymentInfo: invoice,
      federationId: this.federationId,
      gatewayId: this.gatewayId,
    });

    this.logger.log(`Lightning pay response : ${JSON.stringify(res)}`);
    const { operationId, fee }: LightningPayResponse =
      res as LightningPayResponse;

    this.logger.log(`Paid Invoice : ${invoice} : ${operationId}`);
    return {
      operationId,
      fee,
    };
  }

  receive(context: FedimintContext, operationId: string): void {
    this.logger.log(`Receiving payment : ${operationId}`);

    this.post<{ operationId: string } & WithFederationId, any>(
      '/ln/await-invoice',
      {
        operationId,
        federationId: this.federationId,
      },
    )
      .then((resp) => {
        this.logger.log(
          `Update : ${JSON.stringify(resp)} for : ${operationId}`,
        );

        switch (resp.status) {
          case 'created':
          case 'waiting-for-payment':
            // this is a recursive call to continue waiting.
            this.receive(context, operationId);
            break;
          case 'funded':
          case 'awaiting-funds':
          case 'claimed':
            this.eventEmitter.emit(fedimint_receive_success, {
              context,
              operationId,
            });
            break;
          default:
            this.eventEmitter.emit(fedimint_receive_failure, {
              context,
              operationId,
              error: 'Error',
            });
            break;
        }
      })
      .catch((e) => {
        this.logger.error(e);

        this.eventEmitter.emit(fedimint_receive_failure, {
          context,
          operationId,
          error: `${e}`,
        });
      });
  }

  /**
   * Creates an LNURL-withdraw endpoint and returns the encoded LNURL
   * @param maxWithdrawableMsats Maximum amount in millisatoshis that can be withdrawn
   * @param minWithdrawableMsats Minimum amount in millisatoshis that can be withdrawn (optional)
   * @param defaultDescription Default description for the withdrawal (optional)
   * @param expirySeconds Time in seconds until this withdraw request expires (default: no expiry)
   * @returns Object containing LNURL details for generating a QR code
   */
  async createLnUrlWithdrawPoint(
    maxWithdrawableMsats: number,
    minWithdrawableMsats: number = 0,
    defaultDescription: string = 'Bitsacco LNURL Withdraw',
    expirySeconds?: number | undefined,
  ): Promise<LnUrlWithdrawPoint> {
    this.logger.log(
      `Creating LNURL withdraw request for max ${maxWithdrawableMsats} msats`,
    );

    try {
      if (!this.lnUrlCallback) {
        throw new Error('LNURL callback URL not configured');
      }

      const callback = this.lnUrlCallback;
      const k1 = crypto.randomBytes(16).toString('hex');
      const currentTimeSeconds = Math.floor(new Date().getTime() / 1000);
      const expiresAt = expirySeconds
        ? currentTimeSeconds + expirySeconds
        : undefined;

      const shortDescription =
        defaultDescription.length > 20
          ? defaultDescription.substring(0, 20)
          : defaultDescription;

      // Create params - Use shorter parameter names where possible
      // (standard LNURL params cannot be changed though)
      const params = new URLSearchParams({
        callback,
        k1: k1,
        maxWithdrawable: maxWithdrawableMsats.toString(),
        minWithdrawable: minWithdrawableMsats.toString(),
        defaultDescription: shortDescription,
        tag: 'withdrawRequest',
      });

      const url = `${callback}?${params.toString()}`;

      if (url.length > 800) {
        this.logger.warn(
          `URL is too long (${url.length} chars), simplifying parameters`,
        );

        // Create a simplified params set with just the essential parameters
        const simplifiedParams = new URLSearchParams({
          callback,
          k1: k1,
          maxWithdrawable: maxWithdrawableMsats.toString(),
          tag: 'withdrawRequest',
        });

        const simplifiedUrl = `${callback}?${simplifiedParams.toString()}`;
        this.logger.log(
          `Simplified URL length: ${simplifiedUrl.length} characters`,
        );

        // Encode the simplified URL
        const lnurl = this.createBech32Encoding(simplifiedUrl);

        this.logger.log(`Created simplified LNURL withdraw with k1: ${k1}`);
        return {
          lnurl,
          k1,
          callback,
          expiresAt,
        };
      }

      // Encode the URL in bech32 format
      const lnurl = this.createBech32Encoding(url);

      this.logger.log(`Created LNURL withdraw with k1: ${k1}`);
      return {
        lnurl,
        k1,
        callback,
        expiresAt,
      };
    } catch (error) {
      this.logger.error('Failed to create LNURL withdrawal', error);
      throw new Error(`LNURL withdrawal creation failed: ${error.message}`);
    }
  }

  private createBech32Encoding(url: string): string {
    try {
      // Debug log to help with troubleshooting
      this.logger.debug(`Encoding URL (length: ${url.length}): ${url}`);

      // Check if URL is too long for bech32 encoding
      // bech32 has a limit of 90 characters for the data part (excluding hrp)
      // but when considering the 5-bit encoding, this can support roughly 500-600 bytes
      if (url.length > 1000) {
        throw new Error(
          `URL is too long (${url.length} chars) for bech32 encoding`,
        );
      }

      // Convert URL string to 5-bit words
      const words = bech32.toWords(Buffer.from(url, 'utf8'));

      // Encode with bech32 using 'lnurl1' as the human-readable part (prefix)
      return bech32.encode('lnurl', words, 1023);
    } catch (error) {
      // Log and rethrow with more context
      this.logger.error(`Failed to create bech32 encoding: ${error.message}`);
      throw new Error(`Exceeds length limit (URL: ${url.length} chars)`);
    }
  }

  /**
   * Check the status of a transaction using its payment tracker
   * @param paymentTracker The operation ID or payment tracker
   * @returns The transaction status: 'completed', 'failed', 'pending', 'processing', or 'unknown'
   */
  async checkTransactionStatus(paymentTracker: string): Promise<string> {
    try {
      if (!paymentTracker) {
        return 'unknown';
      }

      // Ensure service is initialized
      if (!this.baseUrl || !this.federationId) {
        this.logger.warn('FedimintService not properly initialized');
        return 'unknown';
      }

      // Try to list operations and find the one with matching ID
      try {
        const listResponse = await firstValueFrom(
          this.httpService.post(`${this.baseUrl}/list-operations`, {
            federationId: this.federationId,
            limit: 100, // Adjust based on needs
          }),
        );

        if (listResponse?.data?.operations) {
          const operation = listResponse.data.operations.find(
            (op: any) => op.operationId === paymentTracker,
          );

          if (operation) {
            return this.mapOperationStatus(operation.status || operation.state);
          }
        }
      } catch (listError) {
        this.logger.debug(
          `List operations failed, trying direct status check: ${listError}`,
        );
      }

      // Fallback: Try direct operation status check
      try {
        const statusResponse = await firstValueFrom(
          this.httpService.post(`${this.baseUrl}/operation-status`, {
            federationId: this.federationId,
            operationId: paymentTracker,
          }),
        );

        if (statusResponse?.data?.status || statusResponse?.data?.state) {
          return this.mapOperationStatus(
            statusResponse.data.status || statusResponse.data.state,
          );
        }
      } catch (statusError) {
        this.logger.debug(`Direct status check failed: ${statusError}`);
      }

      // Final fallback: Check if it's a lightning payment
      try {
        const lnStatusResponse = await firstValueFrom(
          this.httpService.post(`${this.baseUrl}/ln-status`, {
            federationId: this.federationId,
            operationId: paymentTracker,
          }),
        );

        if (lnStatusResponse?.data?.status) {
          return this.mapOperationStatus(lnStatusResponse.data.status);
        }
      } catch (lnError) {
        this.logger.debug(`Lightning status check failed: ${lnError}`);
      }

      return 'unknown';
    } catch (error) {
      this.logger.error(
        `Failed to check transaction status for ${paymentTracker}:`,
        error,
      );
      return 'unknown';
    }
  }

  /**
   * Map Fedimint operation status to our simplified status
   */
  private mapOperationStatus(status: string | undefined): string {
    if (!status) return 'unknown';

    const normalizedStatus = status.toLowerCase();

    // Map various possible statuses
    if (
      normalizedStatus.includes('complete') ||
      normalizedStatus.includes('success') ||
      normalizedStatus === 'done' ||
      normalizedStatus === 'finished'
    ) {
      return 'completed';
    }

    if (
      normalizedStatus.includes('fail') ||
      normalizedStatus.includes('error') ||
      normalizedStatus === 'cancelled' ||
      normalizedStatus === 'rejected'
    ) {
      return 'failed';
    }

    if (
      normalizedStatus === 'pending' ||
      normalizedStatus === 'waiting' ||
      normalizedStatus === 'queued'
    ) {
      return 'pending';
    }

    if (
      normalizedStatus.includes('process') ||
      normalizedStatus === 'in_progress' ||
      normalizedStatus === 'active' ||
      normalizedStatus === 'running'
    ) {
      return 'processing';
    }

    return 'unknown';
  }
}

export interface FlatDecodedInvoice {
  paymentHash: string;
  amountMsats: string;
  description: string;
  timestamp: number;
}

export interface LnurlWithdrawParams {
  tag: string;
  callbackUrl: string;
  k1: string;
  defaultDescription: string;
  minWithdrawable: number;
  maxWithdrawable: number;
}
