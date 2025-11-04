import { Module } from '@nestjs/common';
import { PersonalController } from './personal.controller';
import {
  PersonalWalletService,
  TargetService,
  LockService,
  AnalyticsService,
  AtomicWithdrawalService,
  WithdrawalMonitorService,
  WithdrawalRateLimitService,
} from './services';
import { DistributedLockService } from '../common/services';
import { HttpModule } from '@nestjs/axios';
import {
  SolowalletDocument,
  SolowalletRepository,
  SolowalletSchema,
  WithdrawalRateLimit,
  WithdrawalRateLimitSchema,
  WithdrawalRateLimitRepository,
} from './db';
import { SharedModule, DatabaseModule } from '../common';
import { SwapModule } from '../swap';

@Module({
  imports: [
    SharedModule,
    DatabaseModule.forFeature([
      { name: SolowalletDocument.name, schema: SolowalletSchema },
      { name: WithdrawalRateLimit.name, schema: WithdrawalRateLimitSchema },
    ]),
    HttpModule,
    SwapModule,
  ],
  controllers: [PersonalController],
  providers: [
    PersonalWalletService,
    SolowalletRepository,
    TargetService,
    LockService,
    AnalyticsService,
    AtomicWithdrawalService,
    DistributedLockService,
    WithdrawalMonitorService,
    WithdrawalRateLimitService,
    WithdrawalRateLimitRepository,
  ],
  exports: [
    PersonalWalletService,
    SolowalletRepository,
    TargetService,
    LockService,
    AnalyticsService,
    AtomicWithdrawalService,
    DistributedLockService,
    WithdrawalMonitorService,
    WithdrawalRateLimitService,
    WithdrawalRateLimitRepository,
  ],
})
export class PersonalModule {
  constructor() {
    console.log(
      'PersonalModule initialized - Personal Savings Enhancement System',
    );
  }
}
