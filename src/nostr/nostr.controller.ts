import {
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import {
  ConfigureNostrRelaysDto,
  JwtAuthGuard,
  SendEncryptedNostrDmDto,
  HandleServiceErrors,
} from '../common';
import { NostrService } from './nostr.service';

@Controller({
  path: 'nostr',
  version: '2',
})
@UseGuards(JwtAuthGuard)
export class NostrController {
  private readonly logger = new Logger(NostrController.name);

  constructor(private readonly nostrService: NostrService) {
    this.logger.log(
      'NostrController initialized with direct service injection',
    );
  }

  @Post('relays')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Configure nostr relays' })
  @ApiBody({
    type: ConfigureNostrRelaysDto,
  })
  @HandleServiceErrors()
  async configureNostrRelays(
    @Body() req: ConfigureNostrRelaysDto,
  ): Promise<void> {
    return await this.nostrService.configureNostrRelays(req);
  }

  @Post('dm')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Send encrypted nostr dm' })
  @ApiBody({
    type: SendEncryptedNostrDmDto,
  })
  @HandleServiceErrors()
  async send(@Body() req: SendEncryptedNostrDmDto): Promise<void> {
    return await this.nostrService.sendEncryptedDirectMessage(req);
  }
}
