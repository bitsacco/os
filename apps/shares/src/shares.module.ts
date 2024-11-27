import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { DatabaseModule, LoggerModule } from '@bitsacco/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';
import { SharesDocument, SharesRepository, SharesSchema } from './db';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        SHARES_GRPC_URL: Joi.string().required(),
        SHARES_ISSUED: Joi.number().required(),
        DATABASE_URL: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: SharesDocument.name, schema: SharesSchema },
    ]),
    LoggerModule,
  ],
  controllers: [SharesController],
  providers: [SharesService, ConfigService, SharesRepository],
})
export class SharesModule {}
