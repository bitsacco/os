import { ChannelOptions } from '@grpc/grpc-js';
import { GrpcOptions } from '@nestjs/microservices';

export function createGrpcOptions(
  packageName: string,
  protoPath: string,
  url: string,
): GrpcOptions['options'] {
  const channelOptions: ChannelOptions = {
    // Keepalive settings - more aggressive to prevent connection drops
    'grpc.keepalive_time_ms': 30000, // 30 seconds (was 2 minutes)
    'grpc.keepalive_timeout_ms': 10000, // 10 seconds (was 20 seconds)
    'grpc.keepalive_permit_without_calls': 1,
    'grpc.http2.min_sent_ping_interval_without_data_ms': 30000, // 30 seconds

    // HTTP/2 settings to prevent stack overflow
    'grpc.http2.max_pings_without_data': 0,
    'grpc.http2.min_time_between_pings_ms': 30000, // 30 seconds (was 2 minutes)
    'grpc.http2.max_ping_strikes': 3, // Allow 3 failed pings before closing

    // Message size limits
    'grpc.max_receive_message_length': 16 * 1024 * 1024, // 16MB (was unlimited)
    'grpc.max_send_message_length': 16 * 1024 * 1024, // 16MB (was unlimited)

    // Connection management - more aggressive reconnection
    'grpc.initial_reconnect_backoff_ms': 500, // 500ms (was 1 second)
    'grpc.max_reconnect_backoff_ms': 5000, // 5 seconds (was 10 seconds)
    'grpc.enable_retries': 1,
    'grpc.service_config': JSON.stringify({
      loadBalancingPolicy: 'round_robin',
      methodConfig: [
        {
          name: [{}],
          retryPolicy: {
            maxAttempts: 5,
            initialBackoff: '0.5s',
            maxBackoff: '5s',
            backoffMultiplier: 2,
            retryableStatusCodes: [
              'UNAVAILABLE',
              'DEADLINE_EXCEEDED',
              'RESOURCE_EXHAUSTED',
            ],
          },
        },
      ],
    }),

    // Connection pooling
    'grpc.use_local_subchannel_pool': 1, // Enable subchannel pooling
    'grpc.max_concurrent_streams': 100, // Limit concurrent streams per connection

    // Channel args to improve stability - extended timeouts
    'grpc.client_idle_timeout_ms': 900000, // 15 minutes (was 5 minutes)
    'grpc.max_connection_idle_ms': 900000, // 15 minutes (was 5 minutes)
    'grpc.max_connection_age_ms': 3600000, // 1 hour (was 10 minutes)
    'grpc.max_connection_age_grace_ms': 30000, // 30 seconds grace period

    // DNS resolution
    'grpc.dns_min_time_between_resolutions_ms': 30000, // 30 seconds
    'grpc.initial_reconnect_backoff_ms': 1000,
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
