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
  CircuitBreakerService,
  HandleServiceErrors,
  GrpcServiceWrapper,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Controller('nostr')
@UseGuards(JwtAuthGuard)
export class NostrController {
  private nostrService: NostrServiceClient;
  private readonly logger = new Logger(NostrController.name);

  constructor(
    @Inject(NOSTR_SERVICE_NAME) private readonly grpc: ClientGrpc,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly grpcWrapper: GrpcServiceWrapper,
  ) {
    this.nostrService = this.grpcWrapper.createServiceProxy<NostrServiceClient>(
      this.grpc,
      'NOSTR_SERVICE',
      NOSTR_SERVICE_NAME,
    );
    this.logger.log('NostrController initialized');
  }

  @Post('relays')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Configure nostr relays' })
  @ApiBody({
    type: ConfigureNostrRelaysDto,
  })
  @HandleServiceErrors()
  configureNostrRelays(@Body() req: ConfigureNostrRelaysDto) {
    return this.circuitBreaker.execute(
      'nostr-service-configure',
      this.nostrService.configureTrustedNostrRelays(req),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
  }

  @Post('dm')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Send encrypted nostr dm' })
  @ApiBody({
    type: SendEncryptedNostrDmDto,
  })
  @HandleServiceErrors()
  send(@Body() req: SendEncryptedNostrDmDto) {
    return this.circuitBreaker.execute(
      'nostr-service-send-dm',
      this.nostrService.sendEncryptedNostrDirectMessage(req),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
  }
}
