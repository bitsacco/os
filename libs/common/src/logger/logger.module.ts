import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';

        return {
          pinoHttp: {
            // Only use pino-pretty transport in development
            ...(isProduction
              ? {}
              : {
                  transport: {
                    target: 'pino-pretty',
                    options: {
                      singleLine: true,
                    },
                  },
                }),
            redact: {
              paths: ['req.headers', 'res.headers'],
              remove: true,
            },
            level: configService.get<string>('LOG_LEVEL', 'info'),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
