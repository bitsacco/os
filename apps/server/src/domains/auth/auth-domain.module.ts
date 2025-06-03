import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Schemas
import { UsersDocument, UsersSchema } from '../../shared/database/users.schema';
import { TokenDocument, TokenSchema } from '../../shared/database/token.schema';
import {
  ApiKeyDocument,
  ApiKeySchema,
} from '../../shared/database/apikey.schema';

// Services
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { ApiKeyService } from './services/apikey.service';
import { UserService } from './services/user.service';

// Repositories
import { UserRepository } from './repositories/user.repository';
import { TokenRepository } from './repositories/token.repository';
import { ApiKeyRepository } from './repositories/apikey.repository';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { ApiKeyStrategy } from './strategies/apikey.strategy';
import { PhoneStrategy } from './strategies/phone.strategy';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiKeyGuard } from './guards/apikey.guard';
import { CombinedAuthGuard } from './guards/combined-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UsersDocument.name, schema: UsersSchema },
      { name: TokenDocument.name, schema: TokenSchema },
      { name: ApiKeyDocument.name, schema: ApiKeySchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
    // SMS service will be mocked in tests
  ],
  providers: [
    // Services
    AuthService,
    TokenService,
    ApiKeyService,
    UserService,

    // Repositories
    UserRepository,
    TokenRepository,
    ApiKeyRepository,

    // Strategies
    JwtStrategy,
    ApiKeyStrategy,
    PhoneStrategy,

    // Guards
    JwtAuthGuard,
    ApiKeyGuard,
    CombinedAuthGuard,

    // Common services will be provided at app level
  ],
  exports: [
    AuthService,
    TokenService,
    ApiKeyService,
    UserService,
    UserRepository,
    JwtAuthGuard,
    ApiKeyGuard,
    CombinedAuthGuard,
  ],
})
export class AuthDomainModule {}
