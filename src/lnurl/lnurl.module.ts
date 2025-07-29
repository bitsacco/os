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
import { AddressResolverService } from './services/address-resolver.service';
import { LnurlMetricsService } from './lnurl.metrics';

// Schemas
import {
  LnurlTransaction,
  LnurlTransactionSchema,
} from './schemas/lnurl-transaction.schema';
import {
  LightningAddress,
  LightningAddressSchema,
} from './schemas/lightning-address.schema';
import {
  ExternalLnurlTarget,
  ExternalLnurlTargetSchema,
} from './schemas/external-target.schema';

// External dependencies
import { FedimintService } from '../common/fedimint/fedimint.service';
import { SolowalletModule } from '../solowallet/solowallet.module';
import { SolowalletService } from '../solowallet/solowallet.service';
import { ChamaModule } from '../chamas/chama.module';
import { ChamasService } from '../chamas/chamas.service';
import { ChamaWalletService } from '../chamawallet/wallet.service';
import { NotificationModule } from '../notifications/notification.module';
import { SwapModule } from '../swap/swap.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: LnurlTransaction.name, schema: LnurlTransactionSchema },
      { name: LightningAddress.name, schema: LightningAddressSchema },
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
    LnurlWithdrawService,
    LnurlPaymentService,
    LnurlResolverService,
    LnurlCommonService,
    AddressResolverService,
    LnurlMetricsService,
    FedimintService,
    SolowalletService,
    ChamasService,
    ChamaWalletService,
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
