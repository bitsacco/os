import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TransactionTimeoutService, TimeoutConfigService } from '../services';
import {
  ChamaWalletRepository,
  ChamaWalletDocument,
  ChamaWalletSchema,
} from '../../chamawallet/db';
import { FedimintService } from '../fedimint';
import { DatabaseModule } from '../database/database.module';
import { HttpModule } from '@nestjs/axios';
import { PersonalModule } from '../../personal/personal.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule.forFeature([
      { name: ChamaWalletDocument.name, schema: ChamaWalletSchema },
    ]),
    HttpModule,
    PersonalModule,
  ],
  providers: [
    TransactionTimeoutService,
    TimeoutConfigService,
    ChamaWalletRepository,
    FedimintService,
  ],
  exports: [TransactionTimeoutService],
})
export class TimeoutModule {}
