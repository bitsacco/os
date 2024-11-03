import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import {
  FedimintClient,
  LightningInvoiceResponse,
  LightningPaymentResponse,
  LightningPayResponse,
  LnReceiveState,
} from './fmts';
import { EventEmitter2 } from '@nestjs/event-emitter';

export const fedimint_receive_success = 'fedimint.receive.success';
export const fedimint_receive_failure = 'fedimint.receive.failure';

// Scenarios in which onramp swap can receive payment
export enum ReceiveContext {
  FUNDING,
  OFFRAMP,
}

interface ReceivePaymentEvent {
  operationId: string;
  context: ReceiveContext;
}

export interface ReceivePaymentSuccessEvent extends ReceivePaymentEvent {}

export interface ReceivePaymentFailureEvent extends ReceivePaymentEvent {
  error: string;
}

@Injectable()
export class FedimintService {
  private readonly logger = new Logger(FedimintService.name);
  private fedimint: FedimintClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('FedimintService initialized');

    const baseUrl = this.configService.getOrThrow<string>(
      'FEDIMINT_CLIENTD_BASE_URL',
    );
    const password = this.configService.getOrThrow<string>(
      'FEDIMINT_CLIENTD_PASSWORD',
    );
    const federationId = this.configService.getOrThrow<string>(
      'FEDIMINT_FEDERATION_ID',
    );
    const gatewayId = this.configService.getOrThrow<string>(
      'FEDIMINT_GATEWAY_ID',
    );

    this.fedimint = new FedimintClient(
      baseUrl,
      password,
      federationId,
      gatewayId,
    );

    this.logger.log('FedimintService initialized');
  }

  async invoice(
    amountMsat: number,
    description: string,
  ): Promise<{
    invoice: string;
    operationId: string;
  }> {
    this.logger.log('Generating invoice');

    const { invoice, operationId }: LightningInvoiceResponse =
      await this.fedimint.lightning.createInvoice({
        amountMsat,
        description,
      });

    this.logger.log('Invoice : ', invoice);
    return {
      invoice,
      operationId,
    };
  }

  async pay(invoice: string): Promise<{ operationId: string; fee: number }> {
    this.logger.log('Paying invoice');
    this.logger.log('Invoice', invoice);

    const { operationId, fee }: LightningPayResponse =
      await this.fedimint.lightning.pay({
        paymentInfo: invoice,
      });

    this.logger.log('Paid Invoice : ', operationId);
    return {
      operationId,
      fee,
    };
  }

  receive(context: ReceiveContext, operationId: string): void {
    this.logger.log(`Receiving payment : ${operationId}`);

    this.fedimint.lightning
      .awaitInvoice(operationId)
      .then(({ state }: LightningPaymentResponse) => {
        this.logger.log(`Update : ${state} : ${operationId}`);
        switch (state) {
          case LnReceiveState.Created:
          case LnReceiveState.WaitingForPayment:
            // this is a recursive call to continue waiting.
            this.receive(context, operationId);
            break;
          case LnReceiveState.Funded:
          case LnReceiveState.AwaitingFunds:
          case LnReceiveState.Claimed:
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
