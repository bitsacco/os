import * as Joi from 'joi';
import { join } from 'path';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  DatabaseModule,
  LoggerModule,
  SWAP_SERVICE_NAME,
} from '@bitsacco/common';
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
        SWAP_GRPC_URL: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: SolowalletDocument.name, schema: SolowalletSchema },
    ]),
    LoggerModule,
    ClientsModule.registerAsync([
      {
        name: SWAP_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'swap',
            protoPath: join(__dirname, '../../../proto/swap.proto'),
            url: configService.getOrThrow<string>('SWAP_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [SolowalletController],
  providers: [SolowalletService, ConfigService, SolowalletRepository],
})
export class SolowalletModule {}
