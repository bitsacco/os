import { Controller, Logger } from '@nestjs/common';
import { EventPattern, GrpcMethod } from '@nestjs/microservices';
import {
  CreateOnrampSwapDto,
  CreateOfframpSwapDto,
  type FindSwapRequest,
  type PaginatedRequest,
  SwapServiceController,
  SwapServiceControllerMethods,
  QuoteRequestDto,
  process_swap_update,
} from '@bitsacco/common';
import { SwapService } from './swap.service';
import {
  MpesaCollectionUpdateDto,
  MpesaPaymentUpdateDto,
} from './intasend/intasend.dto';

@Controller()
@SwapServiceControllerMethods()
export class SwapController implements SwapServiceController {
  private readonly logger = new Logger(SwapController.name);

  constructor(private readonly swapService: SwapService) {}

  @GrpcMethod()
  getQuote(request: QuoteRequestDto) {
    return this.swapService.getQuote(request);
  }

  @GrpcMethod()
  createOnrampSwap(request: CreateOnrampSwapDto) {
    return this.swapService.createOnrampSwap(request);
  }

  @GrpcMethod()
  findOnrampSwap(request: FindSwapRequest) {
    return this.swapService.findOnrampSwap(request);
  }

  @GrpcMethod()
  listOnrampSwaps(request: PaginatedRequest) {
    return this.swapService.listOnrampSwaps(request);
  }

  @GrpcMethod()
  createOfframpSwap(request: CreateOfframpSwapDto) {
    return this.swapService.createOfframpSwap(request);
  }

  @GrpcMethod()
  findOfframpSwap(request: FindSwapRequest) {
    return this.swapService.findOfframpSwap(request);
  }

  @GrpcMethod()
  listOfframpSwaps(request: PaginatedRequest) {
    return this.swapService.listOfframpSwaps(request);
  }

  @EventPattern(process_swap_update)
  async processSwapUpdate(
    request: MpesaCollectionUpdateDto | MpesaPaymentUpdateDto,
  ) {
    this.logger.log('Processing Swap Update');
    await this.swapService.processSwapUpdate(request);
  }
}
