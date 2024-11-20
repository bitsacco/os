import { ApiOperation, ApiBody } from '@nestjs/swagger';
import { Body, Controller, Logger, Post } from '@nestjs/common';
import {
  ConfigureNostrRelaysDto,
  SendEncryptedNostrDmDto,
} from '@bitsacco/common';
import { NostrService } from './nostr.service';

@Controller('nostr')
export class NostrController {
  private readonly logger = new Logger(NostrController.name);

  constructor(private readonly nostrService: NostrService) {
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
