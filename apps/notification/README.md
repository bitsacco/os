# Notification Service

The Notification service is responsible for managing and delivering notifications across the Bitsacco platform.

## Features

- User notification preferences management
- Multi-channel notification delivery (In-app, SMS, Nostr)
- Notification history and status tracking
- Event-driven notification triggers
- Metrics collection for monitoring

## API

The service exposes a gRPC API with the following endpoints:

### Preferences Management

- `GetPreferences`: Get a user's notification preferences
- `UpdatePreferences`: Update a user's notification preferences

### Notification Management

- `GetNotifications`: Get a list of notifications for a user
- `MarkAsRead`: Mark notifications as read
- `SendNotification`: Send a notification to a user

## Event Handlers

The service listens for the following events:

- `fedimint_receive_success`: Create notification when payment is received
- `fedimint_receive_failure`: Create notification when payment fails
- `swap_status_change`: Create notification when swap status changes
- `collection_for_shares`: Create notification for share collection events

## Configuration

Required environment variables:

- `NOTIFICATION_GRPC_URL`: The URL for the notification gRPC service
- `SMS_GRPC_URL`: The URL for the SMS gRPC service
- `NOSTR_GRPC_URL`: The URL for the Nostr gRPC service
- `REDIS_HOST`: Redis host for the event bus
- `REDIS_PORT`: Redis port for the event bus
- `DATABASE_URL`: MongoDB connection string

## Development

```bash
# Run in development mode
bun run dev:notification

# Build the service
bun run build:notification

# Run tests
bun test apps/notification/src
```

## Notification Channels

The service supports the following notification channels:

1. **In-App**: Stored in the database for retrieval by client applications
2. **SMS**: Delivered via the SMS service
3. **Nostr**: Delivered via the Nostr service as encrypted direct messages
