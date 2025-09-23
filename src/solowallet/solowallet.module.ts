import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import { HttpModule } from '@nestjs/axios';
import { RoleValidationService } from '../common';
import { SolowalletMetricsService } from './solowallet.metrics';
import { SolowalletController } from './solowallet.controller';
import { SolowalletService } from './solowallet.service';
import { PersonalModule } from '../personal/personal.module';

@Module({
  imports: [SharedModule, HttpModule, PersonalModule],
  controllers: [SolowalletController],
  providers: [
    SolowalletService,
    SolowalletMetricsService,
    RoleValidationService,
  ],
  exports: [SolowalletService],
})
export class SolowalletModule {}
