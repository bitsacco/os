import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  CreateOnrampSwapDto,
  type FindSwapRequest,
  type PaginatedRequest,
  type QuoteRequest,
  SwapServiceController,
  SwapServiceControllerMethods,
} from '@bitsacco/common';
import { SwapService } from './swap.service';
import { Observable } from 'rxjs';

@Controller()
@SwapServiceControllerMethods()
export class SwapController implements SwapServiceController {
  constructor(private readonly swapService: SwapService) {}

  @GrpcMethod()
  getQuote(request: QuoteRequest) {
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
}
