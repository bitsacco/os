import { Controller } from '@nestjs/common';
import { SendSmsDto, SmsServiceControllerMethods } from '@bitsacco/common';
import { SmsService } from './sms.service';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
@SmsServiceControllerMethods()
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @GrpcMethod()
  sendSms(request: SendSmsDto) {
    return this.smsService.sendSms(request);
  }

  @GrpcMethod()
  sendBulkSms(data: any) {
    return this.smsService.sendBulkSms(data);
  }
}
