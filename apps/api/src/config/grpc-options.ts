import { ChannelOptions } from '@grpc/grpc-js';
import { GrpcOptions } from '@nestjs/microservices';

export function createGrpcOptions(
  packageName: string,
  protoPath: string,
  url: string,
): GrpcOptions['options'] {
  const channelOptions: ChannelOptions = {
    // Keepalive settings to prevent connection issues
    'grpc.keepalive_time_ms': 120000, // 2 minutes
    'grpc.keepalive_timeout_ms': 20000, // 20 seconds
    'grpc.keepalive_permit_without_calls': 1,

    // HTTP/2 settings to prevent stack overflow
    'grpc.http2.max_pings_without_data': 0,
    'grpc.http2.min_time_between_pings_ms': 120000,
    'grpc.http2.max_ping_strikes': 0,

    // Message size limits
    'grpc.max_receive_message_length': -1, // unlimited
    'grpc.max_send_message_length': -1, // unlimited

    // Connection management
    'grpc.initial_reconnect_backoff_ms': 1000,
    'grpc.max_reconnect_backoff_ms': 10000,
    'grpc.enable_retries': 1,

    // Disable aggressive HTTP/2 optimizations that might cause issues
    'grpc.use_local_subchannel_pool': 0,

    // Channel args to improve stability
    'grpc.client_idle_timeout_ms': 300000, // 5 minutes
    'grpc.max_connection_idle_ms': 300000, // 5 minutes
    'grpc.max_connection_age_ms': 600000, // 10 minutes
    'grpc.max_connection_age_grace_ms': 10000, // 10 seconds grace period
  };

  return {
    package: packageName,
    protoPath,
    url,
    channelOptions,
    // Loader options for better compatibility
    loader: {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
  };
}
