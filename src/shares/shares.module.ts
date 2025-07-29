import * as Joi from 'joi';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Module } from '@nestjs/common';
import {
  DatabaseModule,
  LnurlMetricsService,
  LoggerModule,
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
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
      }),
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: SharesOfferDocument.name, schema: SharesOfferSchema },
      { name: SharesDocument.name, schema: SharesSchema },
    ]),
    LoggerModule,
    JwtConfigModule.forRoot(),
    AuthModule,
  ],
  controllers: [SharesController],
  providers: [
    ConfigService,
    LnurlMetricsService,
    SharesService,
    SharesOfferRepository,
    SharesRepository,
    SharesMetricsService,
    RoleValidationService,
  ],
})
export class SharesModule {}
