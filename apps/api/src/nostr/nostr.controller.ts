import {
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Inject,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ConfigureNostrRelaysDto,
  JwtAuthGuard,
  NOSTR_SERVICE_NAME,
  NostrServiceClient,
  SendEncryptedNostrDmDto,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Controller('nostr')
@UseGuards(JwtAuthGuard)
export class NostrController {
  private nostrService: NostrServiceClient;
  private readonly logger = new Logger(NostrController.name);

  constructor(@Inject(NOSTR_SERVICE_NAME) private readonly grpc: ClientGrpc) {
    this.nostrService =
      this.grpc.getService<NostrServiceClient>(NOSTR_SERVICE_NAME);
    this.logger.log('NostrController initialized');
  }

  @Post('relays')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Configure nostr relays' })
  @ApiBody({
    type: ConfigureNostrRelaysDto,
  })
  configureNostrRelays(@Body() req: ConfigureNostrRelaysDto) {
    return this.nostrService.configureTrustedNostrRelays(req);
  }

  @Post('dm')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Send encrypted nostr dm' })
  @ApiBody({
    type: SendEncryptedNostrDmDto,
  })
  send(@Body() req: SendEncryptedNostrDmDto) {
    return this.nostrService.sendEncryptedNostrDirectMessage(req);
  }
}
