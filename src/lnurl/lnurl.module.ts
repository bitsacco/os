import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Controllers
import { LightningAddressController } from './controllers/lightning-address.controller';
import { LnurlPublicController } from './controllers/lnurl-public.controller';
import { LnurlWithdrawController } from './controllers/lnurl-withdraw.controller';
import { LnurlPaymentController } from './controllers/lnurl-payment.controller';

// Services
import { LightningAddressService } from './services/lightning-address.service';
import { LnurlWithdrawService } from './services/lnurl-withdraw.service';
import { LnurlPaymentService } from './services/lnurl-payment.service';
import { LnurlResolverService } from './services/lnurl-resolver.service';
import { LnurlCommonService } from './services/lnurl-common.service';
import { LnurlTransactionService } from './services/lnurl-transaction.service';
import { LnurlMetricsService } from './lnurl.metrics';

// Schemas
import {
  LnurlTransaction,
  LnurlTransactionSchema,
} from './db/lnurl-transaction.schema';
import {
  LightningAddressDocument,
  LightningAddressSchema,
} from './db/lightning-address.schema';
import {
  ExternalLnurlTarget,
  ExternalLnurlTargetSchema,
} from './db/external-target.schema';

// Repositories
import { LightningAddressRepository } from './db/lightning-address.repository';

// External dependencies
import { FedimintService } from '../common/fedimint/fedimint.service';
import { SolowalletModule } from '../solowallet/solowallet.module';
import { ChamaModule } from '../chamas/chama.module';
import { NotificationModule } from '../notifications/notification.module';
import { SwapModule } from '../swap/swap.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: LnurlTransaction.name, schema: LnurlTransactionSchema },
      { name: LightningAddressDocument.name, schema: LightningAddressSchema },
      { name: ExternalLnurlTarget.name, schema: ExternalLnurlTargetSchema },
    ]),
    SolowalletModule,
    ChamaModule,
    NotificationModule,
    SwapModule,
  ],
  controllers: [
    LightningAddressController,
    LnurlPublicController,
    LnurlWithdrawController,
    LnurlPaymentController,
  ],
  providers: [
    LightningAddressService,
    LightningAddressRepository,
    LnurlWithdrawService,
    LnurlPaymentService,
    LnurlResolverService,
    LnurlCommonService,
    LnurlTransactionService,
    LnurlMetricsService,
    {
      provide: FedimintService,
      useFactory: (
        httpService: HttpService,
        eventEmitter: EventEmitter2,
        configService: ConfigService,
      ) => {
        const fedimintService = new FedimintService(httpService, eventEmitter);
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
    // Services from imported modules are already available
    // SolowalletService - from SolowalletModule
    // ChamasService - from ChamaModule
    // ChamaWalletService - from ChamaModule
    // FxService - from SwapModule
  ],
  exports: [
    LightningAddressService,
    LnurlWithdrawService,
    LnurlPaymentService,
    LnurlResolverService,
    LnurlCommonService,
    LnurlMetricsService,
  ],
})
export class LnurlModule {}
