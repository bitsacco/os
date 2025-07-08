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
  JwtAuthGuard,
  SendBulkSmsDto,
  SendSmsDto,
  SMS_SERVICE_NAME,
  SmsServiceClient,
  CircuitBreakerService,
  HandleServiceErrors,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Controller('sms')
@UseGuards(JwtAuthGuard)
export class SmsController {
  private smsService: SmsServiceClient;
  private readonly logger = new Logger(SmsController.name);

  constructor(
    @Inject(SMS_SERVICE_NAME) private readonly grpc: ClientGrpc,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    this.smsService = this.grpc.getService<SmsServiceClient>(SMS_SERVICE_NAME);
    this.logger.log('SmsController initialized');
  }

  @Post('send-message')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Send a single sms' })
  @ApiBody({
    type: SendSmsDto,
  })
  @HandleServiceErrors()
  configureSmsRelays(@Body() req: SendSmsDto) {
    return this.circuitBreaker.execute(
      'sms-service-send',
      this.smsService.sendSms(req),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
  }

  @Post('send-bulk-message')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Send multiple sms' })
  @ApiBody({
    type: SendBulkSmsDto,
  })
  @HandleServiceErrors()
  send(@Body() req: SendBulkSmsDto) {
    return this.circuitBreaker.execute(
      'sms-service-bulk-send',
      this.smsService.sendBulkSms(req),
      {
        failureThreshold: 3,
        resetTimeout: 10000,
        fallbackResponse: null,
      },
    );
  }
}
