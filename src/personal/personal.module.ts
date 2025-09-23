import { Module } from '@nestjs/common';
import { PersonalController } from './personal.controller';
import {
  PersonalWalletService,
  TargetService,
  LockService,
  AnalyticsService,
} from './services';
import { HttpModule } from '@nestjs/axios';
import {
  SolowalletDocument,
  SolowalletRepository,
  SolowalletSchema,
} from './db';
import { SharedModule, DatabaseModule } from '../common';
import { SwapModule } from '../swap';

@Module({
  imports: [
    SharedModule,
    DatabaseModule.forFeature([
      { name: SolowalletDocument.name, schema: SolowalletSchema },
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
  ],
  exports: [
    PersonalWalletService,
    SolowalletRepository,
    TargetService,
    LockService,
    AnalyticsService,
  ],
})
export class PersonalModule {
  constructor() {
    console.log(
      'PersonalModule initialized - Personal Savings Enhancement System',
    );
  }
}
