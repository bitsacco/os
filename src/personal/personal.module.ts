import { Module, forwardRef } from '@nestjs/common';
import { SolowalletModule } from '../solowallet/solowallet.module';
import { PersonalController } from './personal.controller';
import {
  PersonalWalletService,
  TargetService,
  LockService,
  AnalyticsService,
} from './services';

@Module({
  imports: [
    // Import SolowalletModule to access SolowalletService and SolowalletRepository
    // Use forwardRef to handle potential circular dependencies
    forwardRef(() => SolowalletModule),
  ],
  controllers: [PersonalController],
  providers: [
    PersonalWalletService,
    TargetService,
    LockService,
    AnalyticsService,
  ],
  exports: [
    PersonalWalletService,
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
