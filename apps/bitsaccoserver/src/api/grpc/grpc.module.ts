import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

// Services
import { SwapServiceClient } from './clients/swap-service.client';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'SWAP_SERVICE',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'swap',
            protoPath: join(__dirname, '../../../../proto/swap.proto'),
            url: configService.get<string>(
              'SWAP_SERVICE_URL',
              'localhost:4040',
            ),
            channelOptions: {
              'grpc.keepalive_time_ms': 30000,
              'grpc.keepalive_timeout_ms': 5000,
              'grpc.keepalive_permit_without_calls': true,
              'grpc.http2.max_pings_without_data': 0,
              'grpc.http2.min_time_between_pings_ms': 10000,
              'grpc.http2.min_ping_interval_without_data_ms': 300000,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [SwapServiceClient],
  exports: [SwapServiceClient],
})
export class GrpcModule {}
