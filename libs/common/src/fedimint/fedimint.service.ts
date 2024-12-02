import { AxiosError } from 'axios';
import { catchError, firstValueFrom, map } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import {
  fedimint_receive_success,
  fedimint_receive_failure,
} from './fedimint.const';
import {
  LightningInvoiceResponse,
  LightningPayResponse,
  ReceiveContext,
  WithFederationId,
  WithGatewayId,
} from '@bitsacco/common';
import { decode } from 'light-bolt11-decoder';

@Injectable()
export class FedimintService {
  private readonly logger = new Logger(FedimintService.name);

  private baseUrl: string;
  private password: string;
  private federationId: string;
  private gatewayId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('FedimintService created');

    this.baseUrl = `${this.configService.getOrThrow<string>(
      'FEDIMINT_CLIENTD_BASE_URL',
    )}`;
    this.password = this.configService.getOrThrow<string>(
      'FEDIMINT_CLIENTD_PASSWORD',
    );
    this.federationId = this.configService.getOrThrow<string>(
      'FEDIMINT_FEDERATION_ID',
    );
    this.gatewayId = this.configService.getOrThrow<string>(
      'FEDIMINT_GATEWAY_ID',
    );

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
    this.logger.log('Generating invoice');

    const { invoice, operationId }: LightningInvoiceResponse = await this.post<
      {
        amountMsat: number;
        description: string;
      } & WithFederationId &
        WithGatewayId,
      LightningInvoiceResponse
    >('/ln/invoice', {
      amountMsat,
      description,
      federationId: this.federationId,
      gatewayId: this.gatewayId,
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

    const foo = await this.post<
      { paymentInfo: string } & WithFederationId & WithGatewayId,
      unknown
    >('/ln/pay', {
      paymentInfo: invoice,
      federationId: this.federationId,
      gatewayId: this.gatewayId,
    });

    this.logger.log(foo);
    const { operationId, fee }: LightningPayResponse =
      foo as LightningPayResponse;

    this.logger.log(`Paid Invoice : ${invoice} : ${operationId}`);
    return {
      operationId,
      fee,
    };
  }

  receive(context: ReceiveContext, operationId: string): void {
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
}

interface FlatDecodedInvoice {
  paymentHash: string;
  amountMsats: string;
  description: string;
  timestamp: number;
}
