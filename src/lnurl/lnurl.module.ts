import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

// Controllers
import { LnurlController } from './controllers/lnurl.controller';
import { LightningAddressController } from './controllers/lnaddr.controller';
import { LnurlWithdrawController } from './controllers/lnurlw.controller';
import { LnurlPaymentController } from './controllers/lnurlp.controller';

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
import { SolowalletModule } from '../solowallet/solowallet.module';
import { ChamaModule } from '../chamas/chama.module';
import { NotificationModule } from '../notifications/notification.module';
import { SwapModule } from '../swap';
import { PersonalModule } from '../personal/personal.module';
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
    PersonalModule,
  ],
  controllers: [
    LightningAddressController,
    LnurlController,
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
