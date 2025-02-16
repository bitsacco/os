import { Controller, Logger } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { process_swap_update } from '@bitsacco/common';
import { MpesaCollectionUpdateDto } from './intasend/intasend.dto';
import { SwapService } from './swap.service';

@Controller('events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly swapService: SwapService) {}

  @EventPattern(process_swap_update)
  async handleSwapUpdate(data: MpesaCollectionUpdateDto) {
    this.logger.log('Processing Swap Update');
    await this.swapService.processSwapUpdate(data);
  }
}
