import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

export interface JwtConfigOptions {
  secretKey?: string;
  expirationKey?: string;
}

@Module({})
export class JwtConfigModule {
  static forRoot(options?: JwtConfigOptions): DynamicModule {
    const secretKey = options?.secretKey || 'JWT_SECRET';
    const expirationKey = options?.expirationKey || 'JWT_EXPIRATION';

    return {
      module: JwtConfigModule,
      imports: [
        JwtModule.registerAsync({
          useFactory: (configService: ConfigService) => ({
            secret: configService.getOrThrow<string>(secretKey),
            signOptions: {
              expiresIn: `${configService.getOrThrow(expirationKey)}s`,
            },
          }),
          inject: [ConfigService],
        }),
      ],
      exports: [JwtModule],
    };
  }
}
