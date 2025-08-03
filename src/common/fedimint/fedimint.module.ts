import { Module, Global } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FedimintService } from './fedimint.service';

@Global()
@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    {
      provide: FedimintService,
      useFactory: (
        httpService: HttpService,
        eventEmitter: EventEmitter2,
        configService: ConfigService,
      ) => {
        const fedimintService = new FedimintService(httpService, eventEmitter);

        // Initialize with common configuration
        fedimintService.initialize(
          configService.get<string>('CLIENTD_BASE_URL'),
          configService.get<string>('FEDERATION_ID'),
          configService.get<string>('GATEWAY_ID'),
          configService.get<string>('CLIENTD_PASSWORD'),
          configService.get<string>('LNURL_CALLBACK_BASE_URL'),
        );

        return fedimintService;
      },
      inject: [HttpService, EventEmitter2, ConfigService],
    },
  ],
  exports: [FedimintService],
})
export class FedimintModule {}
