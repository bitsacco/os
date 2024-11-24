import { ApiOperation, ApiBody } from '@nestjs/swagger';
import { Body, Controller, Logger, Post } from '@nestjs/common';
import { SendBulkSmsDto, SendSmsDto } from '@bitsacco/common';
import { SmsService } from './sms.service';

@Controller('sms')
export class SmsController {
  private readonly logger = new Logger(SmsController.name);

  constructor(private readonly smsService: SmsService) {
    this.logger.log('SmsController initialized');
  }

  @Post('send-message')
  @ApiOperation({ summary: 'Send a single sms' })
  @ApiBody({
    type: SendSmsDto,
  })
  configureSmsRelays(@Body() req: SendSmsDto) {
    return this.smsService.sendSms(req);
  }

  @Post('send-bulk-message')
  @ApiOperation({ summary: 'Send multiple sms' })
  @ApiBody({
    type: SendBulkSmsDto,
  })
  send(@Body() req: SendBulkSmsDto) {
    return this.smsService.sendBulkSms(req);
  }
}
