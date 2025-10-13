import {
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import {
  JwtAuthGuard,
  SendBulkSmsDto,
  SendSmsDto,
  HandleServiceErrors,
} from '../common';
import { SmsService } from './sms.service';

@Controller({
  path: 'sms',
})
@UseGuards(JwtAuthGuard)
export class SmsController {
  private readonly logger = new Logger(SmsController.name);

  constructor(private readonly smsService: SmsService) {
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
  async sendSms(@Body() req: SendSmsDto): Promise<void> {
    return await this.smsService.sendSms(req);
  }

  @Post('send-bulk-message')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Send multiple sms' })
  @ApiBody({
    type: SendBulkSmsDto,
  })
  @HandleServiceErrors()
  async sendBulkSms(@Body() req: SendBulkSmsDto): Promise<void> {
    return await this.smsService.sendBulkSms(req);
  }
}
