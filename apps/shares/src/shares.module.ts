import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { LoggerModule } from '@bitsacco/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        SHARES_GRPC_URL: Joi.string().required(),
      }),
    }),
    LoggerModule,
  ],
  controllers: [SharesController],
  providers: [SharesService, ConfigService],
})
export class SharesModule {}
