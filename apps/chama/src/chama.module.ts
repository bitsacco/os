import * as Joi from 'joi';
import { join } from 'path';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  DatabaseModule,
  LoggerModule,
  SMS_SERVICE_NAME,
  UsersDocument,
  UsersRepository,
  UsersSchema,
  UsersService,
} from '@bitsacco/common';
import { ChamasDocument, ChamasRepository, ChamasSchema } from './chamas/db';
import { ChamaMessageService } from './chamas/chamas.messaging';
import { ChamasController } from './chamas/chamas.controller';
import { ChamasService } from './chamas/chamas.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        CHAMA_GRPC_URL: Joi.string().required(),
        SMS_GRPC_URL: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        CHAMA_EXPERIENCE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().required(),
        BITLY_TOKEN: Joi.string().required(),
      }),
    }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.getOrThrow('JWT_EXPIRATION')}s`,
        },
      }),
      inject: [ConfigService],
    }),
    ClientsModule.registerAsync([
      {
        name: SMS_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'sms',
            protoPath: join(__dirname, '../../../proto/sms.proto'),
            url: configService.getOrThrow<string>('SMS_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: ChamasDocument.name, schema: ChamasSchema },
      { name: UsersDocument.name, schema: UsersSchema },
    ]),
    LoggerModule,
  ],
  controllers: [ChamasController],
  providers: [
    ConfigService,
    ChamasService,
    ChamasRepository,
    ChamaMessageService,
    UsersRepository,
    UsersService,
  ],
})
export class ChamaModule {}
