import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TransactionTimeoutService, TimeoutConfigService } from '../services';
import {
  SolowalletRepository,
  SolowalletDocument,
  SolowalletSchema,
} from '../../solowallet/db';
import {
  ChamaWalletRepository,
  ChamaWalletDocument,
  ChamaWalletSchema,
} from '../../chamawallet/db';
import { FedimintService } from '../fedimint';
import { DatabaseModule } from '../database/database.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule.forFeature([
      { name: SolowalletDocument.name, schema: SolowalletSchema },
      { name: ChamaWalletDocument.name, schema: ChamaWalletSchema },
    ]),
    HttpModule,
  ],
  providers: [
    TransactionTimeoutService,
    TimeoutConfigService,
    SolowalletRepository,
    ChamaWalletRepository,
    FedimintService,
  ],
  exports: [TransactionTimeoutService],
})
export class TimeoutModule {}
