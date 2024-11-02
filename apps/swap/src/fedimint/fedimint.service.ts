import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { MpesaOnrampSwap, SwapTransactionState } from '../../prisma/client';
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

  async swapToBtc(
    swap: MpesaOnrampSwap,
  ): Promise<{ state: SwapTransactionState; operationId: string }> {
    this.logger.log('Swapping to BTC');
    this.logger.log('Swap', swap);

    if (
      swap.state === SwapTransactionState.COMPLETE ||
      swap.state === SwapTransactionState.FAILED
    ) {
      throw new Error('Swap transaction alread finalized');
    }

    if (swap.state === SwapTransactionState.PROCESSING) {
      this.logger.log(`Attempting to pay : ${swap.lightning}`);

      const resp: LightningPayResponse = await this.fedimint.lightning.pay({
        paymentInfo: swap.lightning,
      });

      this.logger.log('Lightning payment response', resp);

      return {
        state: SwapTransactionState.COMPLETE,
        operationId: resp.operationId,
      };
    }

    throw new Error('Attempted swap to btc while mpesa is still pending');
  }
}
