import {
  CreateOfframpSwapDto,
  CreateOnrampSwapDto,
  Currency,
  FindSwapRequest,
  ListSwapsDto,
  SWAP_SERVICE_NAME,
  SwapServiceClient,
} from '@bitsacco/common';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Injectable()
export class SwapService implements OnModuleInit {
  private client: SwapServiceClient;

  constructor(@Inject(SWAP_SERVICE_NAME) private readonly grpc: ClientGrpc) {}

  onModuleInit() {
    this.client = this.grpc.getService<SwapServiceClient>(SWAP_SERVICE_NAME);
  }

  getOnrampQuote(req: {
    from: Currency.KES;
    to: Currency.BTC;
    amount?: string;
  }) {
    return this.client.getQuote(req);
  }

  postOnrampTransaction(req: CreateOnrampSwapDto) {
    return this.client.createOnrampSwap(req);
  }

  findOnrampTransaction(req: FindSwapRequest) {
    return this.client.findOnrampSwap(req);
  }

  getOnrampTransactions(req: ListSwapsDto) {
    return this.client.listOnrampSwaps(req);
  }

  getOfframpQuote(req: {
    from: Currency.BTC;
    to: Currency.KES;
    amount?: string;
  }) {
    return this.client.getQuote(req);
  }

  postOfframpTransaction(req: CreateOfframpSwapDto) {
    return this.client.createOfframpSwap(req);
  }

  findOfframpTransaction(req: FindSwapRequest) {
    return this.client.findOfframpSwap(req);
  }

  getOfframpTransactions(req: ListSwapsDto) {
    return this.client.listOfframpSwaps(req);
  }
}
