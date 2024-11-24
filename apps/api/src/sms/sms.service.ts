import {
  SendBulkSmsDto,
  SendSmsDto,
  SMS_SERVICE_NAME,
  SmsServiceClient,
} from '@bitsacco/common';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

@Injectable()
export class SmsService implements OnModuleInit {
  private client: SmsServiceClient;

  constructor(@Inject(SMS_SERVICE_NAME) private readonly grpc: ClientGrpc) {}

  onModuleInit() {
    this.client = this.grpc.getService<SmsServiceClient>(SMS_SERVICE_NAME);
  }

  sendSms(req: SendSmsDto) {
    return this.client.sendSms(req);
  }

  sendBulkSms(req: SendBulkSmsDto) {
    return this.client.sendBulkSms(req);
  }
}
