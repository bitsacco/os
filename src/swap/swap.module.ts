import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import {
  DatabaseModule,
  FedimintService,
  RoleValidationService,
} from '../common';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { FxService } from './fx/fx.service';
import { IntasendService } from './intasend/intasend.service';
import { SwapMetricsService } from './metrics/swap.metrics';
import {
  MpesaOfframpSwapRepository,
  MpesaOfframpSwapDocument,
  MpesaOfframpSwapSchema,
  MpesaOnrampSwapRepository,
  MpesaOnrampSwapDocument,
  MpesaOnrampSwapSchema,
} from './db';

@Module({
  imports: [
    SharedModule,
    DatabaseModule.forFeature([
      { name: MpesaOnrampSwapDocument.name, schema: MpesaOnrampSwapSchema },
      { name: MpesaOfframpSwapDocument.name, schema: MpesaOfframpSwapSchema },
    ]),
    HttpModule,
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 60 * 5 * 1000, // 5 hours in milliseconds
      max: 1000, // Maximum number of items in cache
    }),
  ],
  controllers: [SwapController],
  providers: [
    SwapMetricsService,
    SwapService,
    FxService,
    IntasendService,
    FedimintService,
    MpesaOfframpSwapRepository,
    MpesaOnrampSwapRepository,
    RoleValidationService,
  ],
  exports: [SwapService, FxService],
})
export class SwapModule {}
