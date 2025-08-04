import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule, RoleValidationService } from '../common';
import { SolowalletMetricsService } from './solowallet.metrics';
import {
  SolowalletDocument,
  SolowalletRepository,
  SolowalletSchema,
} from './db';
import { SolowalletController } from './solowallet.controller';
import { SolowalletService } from './solowallet.service';
import { SwapModule } from '../swap/swap.module';

@Module({
  imports: [
    SharedModule,
    DatabaseModule.forFeature([
      { name: SolowalletDocument.name, schema: SolowalletSchema },
    ]),
    HttpModule,
    SwapModule,
  ],
  controllers: [SolowalletController],
  providers: [
    SolowalletService,
    SolowalletRepository,
    SolowalletMetricsService,
    RoleValidationService,
  ],
  exports: [SolowalletService],
})
export class SolowalletModule {}
