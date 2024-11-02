import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { FedimintClient, LightningPayResponse } from './fmts';

@Injectable()
export class FedimintService {
  private readonly logger = new Logger(FedimintService.name);
  private fedimint: FedimintClient;

  constructor(private readonly configService: ConfigService) {
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
}
