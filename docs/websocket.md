# WebSocket Notification Service

The API service provides a WebSocket interface for real-time notifications about system events.

## Documentation

The WebSocket API is documented in the Swagger UI alongside the REST API endpoints. 
Visit `/docs` to see the API documentation, which includes both HTTP and WebSocket endpoints.

## Connection

Connect to the WebSocket server at `ws://your-api-server/notifications` with your JWT authentication token:

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://your-api-server/notifications', {
  auth: {
    token: 'your-jwt-token-here'
  }
});

// Listen for connection events
socket.on('connect', () => {
  console.log('Connected to notification service');
});

socket.on('disconnect', () => {
  console.log('Disconnected from notification service');
});
```

## Available Events

### System Events

The server will emit these events to connected clients:

- `connection:established` - Emitted immediately after successful connection and authentication
- `notification:created` - A new notification has been created for the user
- `notification:delivered` - A notification has been delivered through a specific channel
- `preferences:updated` - The user's notification preferences have been updated

### Client Events (Messages)

Clients can send these messages to the server:

- `subscribe` - Subscribe to specific notification topics
- `unsubscribe` - Unsubscribe from notification topics
- `getNotifications` - Fetch notifications for the user
- `markAsRead` - Mark notifications as read
- `updatePreferences` - Update notification preferences

## Examples

### Subscribing to Topics

```javascript
// Subscribe to specific notification topics
socket.emit('subscribe', ['transaction-123', 'swap-456'], (response) => {
  console.log('Subscription response:', response);
});
```

### Listening for Notifications

```javascript
// Listen for new notifications
socket.on('notification:created', (notification) => {
  console.log('New notification:', notification);
  // Show notification to user
});

// Listen for topic-specific notifications
socket.on('notification:topic', (notification) => {
  console.log('Topic notification:', notification);
});
```

### Retrieving Notifications

```javascript
// Get user's notifications
socket.emit('getNotifications', 
  { 
    unreadOnly: true,
    page: 0,
    size: 10,
    topics: [0, 3] // TRANSACTION and SWAP topics
  }, 
  (response) => {
    if (response.success) {
      console.log('Notifications:', response.data.notifications);
    } else {
      console.error('Error fetching notifications:', response.error);
    }
  }
);
```

### Marking Notifications as Read

```javascript
// Mark specific notifications as read
socket.emit('markAsRead', 
  { 
    notificationIds: ['notification-id-1', 'notification-id-2'] 
  }, 
  (response) => {
    if (response.success) {
      console.log('Notifications marked as read');
    } else {
      console.error('Error marking notifications as read:', response.error);
    }
  }
);

// Mark all notifications as read
socket.emit('markAsRead', {}, (response) => {
  if (response.success) {
    console.log('All notifications marked as read');
  }
});
```

### Updating Preferences

```javascript
// Update notification preferences
socket.emit('updatePreferences', 
  {
    channels: [
      { channel: 0, enabled: true },  // IN_APP
      { channel: 1, enabled: false }, // SMS
      { channel: 2, enabled: true }   // NOSTR
    ],
    topics: [
      {
        topic: 0, // TRANSACTION
        enabled: true,
        channels: [0, 2] // IN_APP and NOSTR
      }
    ]
  }, 
  (response) => {
    if (response.success) {
      console.log('Preferences updated successfully');
    } else {
      console.error('Error updating preferences:', response.error);
    }
  }
);
```