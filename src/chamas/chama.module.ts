import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import { HttpModule } from '@nestjs/axios';
import {
  DatabaseModule,
  RoleValidationService,
  UsersDocument,
  UsersRepository,
  UsersSchema,
  UsersService,
} from '../common';
import { ChamasService } from '../chamas/chamas.service';
import { ChamaWalletService } from '../chamawallet/wallet.service';
import {
  ChamaAtomicWithdrawalService,
  ChamaBalanceService,
} from '../chamawallet/services';
import { DistributedLockService } from '../common/services';
import { ChamaMetricsService } from '../chamas/chama.metrics';
import { SwapModule } from '../swap/swap.module';
import { ChamasDocument, ChamasRepository, ChamasSchema } from '../chamas/db';
import {
  ChamaWalletDocument,
  ChamaWalletRepository,
  ChamaWalletSchema,
} from '../chamawallet/db';
import { ChamaMessageService } from './chamas.messaging';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    SharedModule,
    DatabaseModule.forFeature([
      { name: ChamasDocument.name, schema: ChamasSchema },
      { name: ChamaWalletDocument.name, schema: ChamaWalletSchema },
      { name: UsersDocument.name, schema: UsersSchema },
    ]),
    SwapModule,
    SmsModule,
    HttpModule,
  ],
  providers: [
    ChamasService,
    ChamaWalletService,
    ChamaAtomicWithdrawalService,
    ChamaBalanceService,
    DistributedLockService,
    ChamasRepository,
    ChamaWalletRepository,
    ChamaMetricsService,
    RoleValidationService,
    ChamaMessageService,
    UsersService,
    UsersRepository,
  ],
  exports: [
    ChamasService,
    ChamaWalletService,
    ChamaAtomicWithdrawalService,
    ChamaBalanceService,
    DistributedLockService,
  ],
})
export class ChamaModule {}
