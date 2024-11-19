import { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiBody } from '@nestjs/swagger';
import { Body, Controller, Inject, Logger, Post } from '@nestjs/common';
import {
  ConfigureNostrRelaysDto,
  EVENTS_SERVICE_BUS,
  SendEncryptedNostrDmDto,
} from '@bitsacco/common';
import { NostrService } from './nostr.service';

@Controller('nostr')
export class NostrController {
  private readonly logger = new Logger(NostrController.name);

  constructor(
    private readonly nostrService: NostrService,
    @Inject(EVENTS_SERVICE_BUS) private readonly eventsClient: ClientProxy,
  ) {
    this.logger.log('NostrController initialized');
  }

  @Post('relays')
  @ApiOperation({ summary: 'Configure nostr relays' })
  @ApiBody({
    type: ConfigureNostrRelaysDto,
  })
  configureNostrRelays(@Body() req: ConfigureNostrRelaysDto) {
    return this.nostrService.configureNostrRelays(req);
  }

  @Post('dm')
  @ApiOperation({ summary: 'Send encrypted nostr dm' })
  @ApiBody({
    type: SendEncryptedNostrDmDto,
  })
  send(@Body() req: SendEncryptedNostrDmDto) {
    return this.nostrService.sendEncryptedNostrDm(req);
  }
}
