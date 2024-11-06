import { TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { createTestingModuleWithValidation } from '@bitsacco/common';
import { EventsController } from './events.controller';
import { MpesaCollectionUpdateDto } from './dto';
import { SwapService } from './swap.service';
import { MpesaTransactionState } from './intasend/intasend.types';

describe('EventsController', () => {
  let controller: EventsController;
  let swapService: SwapService;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModuleWithValidation({
      imports: [ConfigModule],
      controllers: [EventsController],
      providers: [
        {
          provide: SwapService,
          useValue: {
            processSwapUpdate: jest.fn(),
          },
        },
      ],
    });

    controller = module.get<EventsController>(EventsController);
    swapService = module.get<SwapService>(SwapService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call processSwapUpdate', async () => {
    const data: MpesaCollectionUpdateDto = {
      invoice_id: 'invid',
      challenge: 'BITSACCO',
      state: MpesaTransactionState.Processing,
      failed_reason: null,
    };
    await controller.handleSwapUpdate(data);
    expect(swapService.processSwapUpdate).toHaveBeenCalledWith(data);
  });
});
