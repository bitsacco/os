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
        // Use getOrThrow to ensure required configuration values are present
        fedimintService.initialize(
          configService.getOrThrow<string>('CLIENTD_BASE_URL'),
          configService.getOrThrow<string>('FEDERATION_ID'),
          configService.getOrThrow<string>('GATEWAY_ID'),
          configService.getOrThrow<string>('CLIENTD_PASSWORD'),
          configService.getOrThrow<string>('LNURL_CALLBACK_BASE_URL'),
        );

        return fedimintService;
      },
      inject: [HttpService, EventEmitter2, ConfigService],
    },
  ],
  exports: [FedimintService],
})
export class FedimintModule {}
