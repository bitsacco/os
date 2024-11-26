import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { DatabaseModule, LoggerModule } from '@bitsacco/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SolowalletController } from './solowallet.controller';
import { SolowalletService } from './solowallet.service';
import {
  SolowalletDocument,
  SolowalletRepository,
  SolowalletSchema,
} from './db';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        SOLOWALLET_GRPC_URL: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: SolowalletDocument.name, schema: SolowalletSchema },
    ]),
    LoggerModule,
  ],
  controllers: [SolowalletController],
  providers: [SolowalletService, ConfigService, SolowalletRepository],
})
export class SolowalletModule {}
