import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import {
  DatabaseModule,
  LnurlMetricsService,
  RoleValidationService,
} from '../common';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';
import {
  SharesDocument,
  SharesOfferDocument,
  SharesOfferRepository,
  SharesOfferSchema,
  SharesRepository,
  SharesSchema,
} from './db';
import { SharesMetricsService } from './shares.metrics';
import { JwtConfigModule } from '../common/jwt-config.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    SharedModule,
    DatabaseModule.forFeature([
      { name: SharesOfferDocument.name, schema: SharesOfferSchema },
      { name: SharesDocument.name, schema: SharesSchema },
    ]),
    AuthModule,
  ],
  controllers: [SharesController],
  providers: [
    LnurlMetricsService,
    SharesService,
    SharesOfferRepository,
    SharesRepository,
    SharesMetricsService,
    RoleValidationService,
  ],
})
export class SharesModule {}
