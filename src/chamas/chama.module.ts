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
} from '../common';
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
import { SmsModule } from '../sms/sms.module';
import { JwtConfigModule } from '../common/jwt-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        CHAMA_CLIENTD_BASE_URL: Joi.string().required(),
        CHAMA_CLIENTD_PASSWORD: Joi.string().required(),
        CHAMA_FEDERATION_ID: Joi.string().required(),
        CHAMA_GATEWAY_ID: Joi.string().required(),
        CHAMA_EXPERIENCE_URL: Joi.string().required(),
        CHAMA_LNURL_CALLBACK: Joi.string().required(),
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
    SmsModule,
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      verboseMemoryLeak: true,
    }),
    HttpModule,
    JwtConfigModule.forRoot(),
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
