import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

// Controllers
import { LightningAddressController } from './controllers/lightning-address.controller';
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
import { SolowalletService } from '../solowallet/solowallet.service';
import { ChamaModule } from '../chamas/chama.module';
import { ChamasService } from '../chamas/chamas.service';
import { ChamaWalletService } from '../chamawallet/wallet.service';
import { NotificationModule } from '../notifications/notification.module';
import { SwapModule } from '../swap/swap.module';
import { FxService } from '../swap/fx/fx.service';

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
    FedimintService,
    SolowalletService,
    ChamasService,
    ChamaWalletService,
    FxService,
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
