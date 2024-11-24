import africastalking from 'africastalking';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { SendBulkSmsDto, SendSmsDto } from '@bitsacco/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private at;
  private smsconfig: { from: string; keyword: string };

  constructor(private readonly configService: ConfigService) {
    this.logger.log('SmsService created');

    this.at = africastalking({
      apiKey: this.configService.getOrThrow<string>('SMS_AT_API_KEY'),
      username: this.configService.getOrThrow<string>('SMS_AT_USERNAME'),
    });
    this.smsconfig = {
      from: this.configService.getOrThrow<string>('SMS_AT_FROM'),
      keyword: this.configService.getOrThrow<string>('SMS_AT_KEYWORD'),
    };
  }

  async sendSms({ message, receiver }: SendSmsDto): Promise<void> {
    this.logger.log(`Sending sms to ${receiver} with message ${message}`);

    const response = await this.at.SMS.send({
      ...this.smsconfig,
      to: receiver,
      message,
    });

    this.logger.log(`Sms sent with response ${JSON.stringify(response)}`);
  }

  async sendBulkSms({ message, receivers }: SendBulkSmsDto): Promise<void> {
    this.logger.log(
      `Sending bulk sms to ${receivers} with messages ${message}`,
    );

    const response = await this.at.SMS.send({
      ...this.smsconfig,
      to: receivers,
      message,
    });
    this.logger.log(`Bulk sms sent with response ${JSON.stringify(response)}`);
  }
}
