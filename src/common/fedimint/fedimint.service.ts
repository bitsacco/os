import { bech32 } from 'bech32';
import * as crypto from 'crypto';
import { AxiosError } from 'axios';
import { decode } from 'light-bolt11-decoder';
import { catchError, firstValueFrom, map } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';
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
  TransactionStatus,
  ChamaTxStatus,
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
    // Validate required configuration values
    if (!baseUrl || typeof baseUrl !== 'string') {
      throw new Error(
        'CLIENTD_BASE_URL is required and must be a valid string',
      );
    }
    if (!federationId || typeof federationId !== 'string') {
      throw new Error('FEDERATION_ID is required and must be a valid string');
    }
    if (!gatewayId || typeof gatewayId !== 'string') {
      throw new Error('GATEWAY_ID is required and must be a valid string');
    }
    if (!password || typeof password !== 'string') {
      throw new Error(
        'CLIENTD_PASSWORD is required and must be a valid string',
      );
    }

    // Validate URL format
    try {
      new URL(baseUrl);
    } catch {
      throw new Error(
        `CLIENTD_BASE_URL must be a valid URL. Received: ${baseUrl}`,
      );
    }
    this.baseUrl = baseUrl;
    this.federationId = federationId;
    this.gatewayId = gatewayId;
    this.password = password;
    if (lnUrlCallback) {
      this.lnUrlCallback = lnUrlCallback;
    }
    this.logger.log('FedimintService initialized with validated configuration');
  }

  private async post<S, T>(endpoint: string, data: S): Promise<T> {
    const url = `${this.baseUrl}/v2${endpoint}`;
    this.logger.log(`POST ${url} : ${JSON.stringify(data)}`);

    // fmcd uses HTTP Basic Authentication (matching phoenixd's auth model)
    // Username is always "fmcd", password is from config
    const username = 'fmcd';
    const basicAuth = Buffer.from(`${username}:${this.password}`).toString(
      'base64',
    );

    return firstValueFrom(
      this.httpService
        .post<T>(url, data, {
          headers: {
            Authorization: `Basic ${basicAuth}`,
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
    // Ensure amountMsat is always an integer (no decimal places)
    const amountMsatInt = Math.floor(amountMsat);

    this.logger.log(
      `Generating invoice for amount: ${amountMsatInt} msats (fees implicitly included)`,
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
      amountMsat: amountMsatInt,
      description,
      federationId: this.federationId,
      gatewayId: this.gatewayId,
      extra_meta: {
        feeLimit: Math.round(amountMsatInt * FEE_LIMIT_PERCENTAGE),
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

  /**
   * Poll for invoice payment status using the v2 API
   * Replaces the deprecated /ln/await-invoice endpoint with polling /ln/operation/:id/status
   */
  receive(context: FedimintContext, operationId: string): void {
    this.logger.log(
      `Polling for invoice payment status (context: ${context}, operationId: ${operationId})`,
    );

    // Poll the new v2 status endpoint: GET /v2/ln/operation/:operation_id/status?federationId=xxx
    const url = `${this.baseUrl}/v2/ln/operation/${operationId}/status?federationId=${this.federationId}`;
    const username = 'fmcd';
    const basicAuth = Buffer.from(`${username}:${this.password}`).toString(
      'base64',
    );

    this.logger.debug(
      `Polling invoice status: GET ${url} (operation: ${operationId})`,
    );

    firstValueFrom(
      this.httpService
        .get<any>(url, {
          headers: {
            Authorization: `Basic ${basicAuth}`,
          },
        })
        .pipe(map((resp) => resp.data))
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(
              `Failed to poll invoice status for ${operationId}: ${error.message}`,
            );
            this.logger.debug(
              `Error details: ${JSON.stringify(error.response?.data || error)}`,
            );
            throw error;
          }),
        ),
    )
      .then((resp) => {
        this.logger.debug(
          `Received invoice status response for ${operationId}: ${JSON.stringify(resp)}`,
        );

        // The status field can be either a string or an object (Rust enum with data)
        // Examples:
        //   - String: "created", "pending"
        //   - Object: { "claimed": { "amount_received_msat": 1000, ... } }
        //   - Object: { "canceled": { "reason": "...", ... } }
        const rawStatus = resp?.status;

        // Extract the status variant name (handle both string and object formats)
        let status: string;
        if (typeof rawStatus === 'string') {
          status = rawStatus.toLowerCase();
          this.logger.debug(
            `Invoice ${operationId} status (string): ${status}`,
          );
        } else if (typeof rawStatus === 'object' && rawStatus !== null) {
          // For objects, the variant name is the first (and only) key
          const keys = Object.keys(rawStatus);
          status = keys.length > 0 ? keys[0].toLowerCase() : 'unknown';
          this.logger.debug(
            `Invoice ${operationId} status (object): extracted '${status}' from ${JSON.stringify(rawStatus)}`,
          );
        } else {
          status = 'unknown';
          this.logger.warn(
            `Unexpected status format for ${operationId}: ${JSON.stringify(rawStatus)}`,
          );
        }

        switch (status) {
          case 'created':
          case 'waiting-for-payment':
          case 'waitingforpayment':
          case 'pending':
            // Continue polling - wait 2 seconds before next poll
            this.logger.debug(
              `Invoice ${operationId} still pending (${status}), will poll again in 2s`,
            );
            setTimeout(() => this.receive(context, operationId), 2000);
            break;
          case 'funded':
          case 'awaiting-funds':
          case 'awaitingfunds':
          case 'claimed':
            this.logger.log(
              `✓ Invoice ${operationId} successfully paid (status: ${status}, context: ${context})`,
            );
            this.eventEmitter.emit(fedimint_receive_success, {
              context,
              operationId,
            });
            break;
          case 'canceled':
          case 'cancelled':
          case 'expired':
            this.logger.warn(
              `✗ Invoice ${operationId} not paid (status: ${status}, context: ${context})`,
            );
            this.eventEmitter.emit(fedimint_receive_failure, {
              context,
              operationId,
              error: `Invoice ${status}`,
            });
            break;
          default:
            this.logger.error(
              `✗ Unknown invoice status '${status}' for ${operationId} (context: ${context}), treating as failure. Raw: ${JSON.stringify(rawStatus)}`,
            );
            this.eventEmitter.emit(fedimint_receive_failure, {
              context,
              operationId,
              error: `Unknown status: ${status}`,
            });
            break;
        }
      })
      .catch((e) => {
        this.logger.error(
          `✗ Failed to receive payment for ${operationId} (context: ${context}): ${e.message || e}`,
        );
        this.logger.debug(`Full error: ${JSON.stringify(e)}`);

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
   * @returns The transaction status as a TransactionStatus enum value
   */
  async checkTransactionStatus(
    paymentTracker: string,
  ): Promise<TransactionStatus> {
    try {
      if (!paymentTracker) {
        this.logger.warn('No payment tracker provided');
        return TransactionStatus.UNRECOGNIZED;
      }

      // Ensure service is initialized
      if (!this.baseUrl || !this.federationId) {
        this.logger.warn('FedimintService not properly initialized');
        return TransactionStatus.UNRECOGNIZED;
      }

      // Try to list operations and find the one with matching ID
      // Using the v2 API endpoint: /v2/admin/operations
      try {
        const listResponse = await this.post<
          { federationId: string; limit: number },
          {
            operations: Array<{
              operationId: string;
              status?: string;
              state?: string;
            }>;
          }
        >('/admin/operations', {
          federationId: this.federationId,
          limit: 100, // Adjust based on needs
        });

        if (listResponse?.operations) {
          const operation = listResponse.operations.find(
            (op: any) => op.operationId === paymentTracker,
          );

          if (operation) {
            return this.mapOperationStatus(operation.status || operation.state);
          }
        }
      } catch (listError) {
        this.logger.debug(
          `List operations failed, trying lightning status check: ${listError}`,
        );
      }

      // Fallback: Check if it's a lightning payment
      // Using the v2 API endpoint: GET /v2/ln/operation/:operation_id/status?federationId=xxx
      try {
        const url = `${this.baseUrl}/v2/ln/operation/${paymentTracker}/status?federationId=${this.federationId}`;
        const username = 'fmcd';
        const basicAuth = Buffer.from(`${username}:${this.password}`).toString(
          'base64',
        );

        const lnStatusResponse = await firstValueFrom(
          this.httpService
            .get<{ status: any }>(url, {
              headers: {
                Authorization: `Basic ${basicAuth}`,
              },
            })
            .pipe(map((resp) => resp.data))
            .pipe(
              catchError((error: AxiosError) => {
                this.logger.debug(
                  `Lightning status check failed: ${error.message}`,
                );
                throw error;
              }),
            ),
        );

        if (lnStatusResponse?.status) {
          // The status field can be either a string or an object with variant name
          const statusValue =
            typeof lnStatusResponse.status === 'string'
              ? lnStatusResponse.status
              : lnStatusResponse.status.variant ||
                lnStatusResponse.status.type ||
                JSON.stringify(lnStatusResponse.status);

          return this.mapOperationStatus(statusValue);
        }
      } catch (lnError) {
        this.logger.debug(`Lightning status check failed: ${lnError}`);
      }

      return TransactionStatus.UNRECOGNIZED;
    } catch (error) {
      this.logger.error(
        `Failed to check transaction status for ${paymentTracker}:`,
        error,
      );
      return TransactionStatus.UNRECOGNIZED;
    }
  }

  /**
   * Map Fedimint operation status to TransactionStatus enum
   */
  private mapOperationStatus(status: string | undefined): TransactionStatus {
    if (!status) {
      this.logger.debug('No status provided to map');
      return TransactionStatus.UNRECOGNIZED;
    }

    const normalizedStatus = status.toLowerCase();

    // Map various possible statuses to TransactionStatus enum
    if (
      normalizedStatus.includes('complete') ||
      normalizedStatus.includes('success') ||
      normalizedStatus === 'done' ||
      normalizedStatus === 'finished' ||
      normalizedStatus === 'claimed' ||
      normalizedStatus === 'funded'
    ) {
      this.logger.debug(`Mapping status '${status}' to COMPLETE`);
      return TransactionStatus.COMPLETE;
    }

    if (
      normalizedStatus.includes('fail') ||
      normalizedStatus.includes('error') ||
      normalizedStatus === 'cancelled' ||
      normalizedStatus === 'rejected' ||
      normalizedStatus === 'timeout'
    ) {
      this.logger.debug(`Mapping status '${status}' to FAILED`);
      return TransactionStatus.FAILED;
    }

    if (
      normalizedStatus === 'pending' ||
      normalizedStatus === 'waiting' ||
      normalizedStatus === 'queued' ||
      normalizedStatus === 'created' ||
      normalizedStatus === 'waiting-for-payment'
    ) {
      this.logger.debug(`Mapping status '${status}' to PENDING`);
      return TransactionStatus.PENDING;
    }

    if (
      normalizedStatus.includes('process') ||
      normalizedStatus === 'in_progress' ||
      normalizedStatus === 'active' ||
      normalizedStatus === 'running' ||
      normalizedStatus === 'awaiting-funds'
    ) {
      this.logger.debug(`Mapping status '${status}' to PROCESSING`);
      return TransactionStatus.PROCESSING;
    }

    this.logger.warn(
      `Unknown fedimint status '${status}', mapping to UNRECOGNIZED`,
    );
    return TransactionStatus.UNRECOGNIZED;
  }

  /**
   * Check the status of a chama transaction using its payment tracker
   * @param paymentTracker The operation ID or payment tracker
   * @returns The transaction status as a ChamaTxStatus enum value
   */
  async checkChamaTransactionStatus(
    paymentTracker: string,
  ): Promise<ChamaTxStatus> {
    const status = await this.checkTransactionStatus(paymentTracker);

    // Map TransactionStatus to ChamaTxStatus
    switch (status) {
      case TransactionStatus.COMPLETE:
        return ChamaTxStatus.COMPLETE;
      case TransactionStatus.FAILED:
        return ChamaTxStatus.FAILED;
      case TransactionStatus.PENDING:
        return ChamaTxStatus.PENDING;
      case TransactionStatus.PROCESSING:
        return ChamaTxStatus.PROCESSING;
      case TransactionStatus.UNRECOGNIZED:
        return ChamaTxStatus.UNRECOGNIZED;
      default:
        this.logger.warn(
          `Unmapped TransactionStatus ${status}, returning UNRECOGNIZED`,
        );
        return ChamaTxStatus.UNRECOGNIZED;
    }
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
