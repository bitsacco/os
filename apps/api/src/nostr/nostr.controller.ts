import { ApiOperation, ApiBody } from '@nestjs/swagger';
import { Body, Controller, Inject, Logger, Post } from '@nestjs/common';
import {
  ConfigureNostrRelaysDto,
  NOSTR_SERVICE_NAME,
  NostrServiceClient,
  SendEncryptedNostrDmDto,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Controller('nostr')
export class NostrController {
  private nostrService: NostrServiceClient;
  private readonly logger = new Logger(NostrController.name);

  constructor(@Inject(NOSTR_SERVICE_NAME) private readonly grpc: ClientGrpc) {
    this.nostrService =
      this.grpc.getService<NostrServiceClient>(NOSTR_SERVICE_NAME);
    this.logger.log('NostrController initialized');
  }

  @Post('relays')
  @ApiOperation({ summary: 'Configure nostr relays' })
  @ApiBody({
    type: ConfigureNostrRelaysDto,
  })
  configureNostrRelays(@Body() req: ConfigureNostrRelaysDto) {
    return this.nostrService.configureTrustedNostrRelays(req);
  }

  @Post('dm')
  @ApiOperation({ summary: 'Send encrypted nostr dm' })
  @ApiBody({
    type: SendEncryptedNostrDmDto,
  })
  send(@Body() req: SendEncryptedNostrDmDto) {
    return this.nostrService.sendEncryptedNostrDirectMessage(req);
  }
}
