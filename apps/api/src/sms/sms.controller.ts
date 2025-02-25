import { ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
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
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Controller('sms')
@UseGuards(JwtAuthGuard)
export class SmsController {
  private smsService: SmsServiceClient;
  private readonly logger = new Logger(SmsController.name);

  constructor(@Inject(SMS_SERVICE_NAME) private readonly grpc: ClientGrpc) {
    this.smsService = this.grpc.getService<SmsServiceClient>(SMS_SERVICE_NAME);
    this.logger.log('SmsController initialized');
  }

  @Post('send-message')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a single sms' })
  @ApiBody({
    type: SendSmsDto,
  })
  configureSmsRelays(@Body() req: SendSmsDto) {
    return this.smsService.sendSms(req);
  }

  @Post('send-bulk-message')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send multiple sms' })
  @ApiBody({
    type: SendBulkSmsDto,
  })
  send(@Body() req: SendBulkSmsDto) {
    return this.smsService.sendBulkSms(req);
  }
}
