import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';
import {
  DatabaseModule,
  FedimintService,
  LoggerModule,
  RoleValidationService,
  UsersDocument,
  UsersRepository,
  UsersSchema,
  UsersService,
  LnurlMetricsService,
} from '@bitsacco/common';
import { ChamasService } from '../chamas/chamas.service';
import { ChamaWalletService } from '../chamawallet/wallet.service';
import { ChamaMetricsService } from '../chamas/chama.metrics';
import { SwapModule } from '../swap/swap.module';
import { ChamasDocument, ChamasRepository, ChamasSchema } from '../chamas/db';
import {
  ChamaWalletDocument,
  ChamaWalletRepository,
  ChamaWalletSchema,
} from '../chamawallet/db';
import { ChamaMessageService } from './chamas.messaging';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        FEDIMINT_CLIENTD_BASE_URL: Joi.string().required(),
        FEDIMINT_CLIENTD_PASSWORD: Joi.string().required(),
        FEDIMINT_FEDERATION_ID: Joi.string().required(),
        FEDIMINT_GATEWAY_ID: Joi.string().required(),
        CHAMA_EXPERIENCE_URL: Joi.string().required(),
        LNURL_CALLBACK: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().required(),
        BITLY_TOKEN: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: ChamasDocument.name, schema: ChamasSchema },
      { name: ChamaWalletDocument.name, schema: ChamaWalletSchema },
      { name: UsersDocument.name, schema: UsersSchema },
    ]),
    LoggerModule,
    SwapModule,
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      verboseMemoryLeak: true,
    }),
    HttpModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.getOrThrow('JWT_EXPIRATION')}s`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    ChamasService,
    ChamaWalletService,
    ConfigService,
    ChamasRepository,
    ChamaWalletRepository,
    FedimintService,
    ChamaMetricsService,
    RoleValidationService,
    ChamaMessageService,
    UsersService,
    UsersRepository,
    LnurlMetricsService,
  ],
  exports: [ChamasService, ChamaWalletService],
})
export class ChamaModule {}
