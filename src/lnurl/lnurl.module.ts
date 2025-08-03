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
import { UsersDocument, UsersSchema } from '../common/database';

// Repositories
import { LightningAddressRepository } from './db/lightning-address.repository';

// External dependencies
import { FedimintService } from '../common/fedimint/fedimint.service';
import { SolowalletModule } from '../solowallet/solowallet.module';
import { ChamaModule } from '../chamas/chama.module';
import { NotificationModule } from '../notifications/notification.module';
import { SwapModule } from '../swap/swap.module';
import { UsersService } from '../common/users/users.service';
import { UsersRepository } from '../common/users/users.repository';
import { RoleValidationService } from '../common/auth/role-validation.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: LnurlTransaction.name, schema: LnurlTransactionSchema },
      { name: LightningAddressDocument.name, schema: LightningAddressSchema },
      { name: ExternalLnurlTarget.name, schema: ExternalLnurlTargetSchema },
      { name: UsersDocument.name, schema: UsersSchema },
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
    UsersService,
    UsersRepository,
    RoleValidationService,
    // FedimintService is now provided globally by FedimintModule in SharedModule
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
