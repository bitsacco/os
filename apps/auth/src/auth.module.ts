import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  DatabaseModule,
  LoggerModule,
  UsersDocument,
  UsersSchema,
} from '@bitsacco/common';
import { UsersRepository } from './users/users.repository';
import { UsersService } from './users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        AUTH_GRPC_URL: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().required(),
        SALT_ROUNDS: Joi.number().required(),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: UsersDocument.name, schema: UsersSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.get('JWT_EXPIRATION')}s`,
        },
      }),
      inject: [ConfigService],
    }),
    LoggerModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersRepository, UsersService],
})
export class AuthModule {}
