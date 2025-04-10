// Notification Client Example (JavaScript)
import { io } from 'socket.io-client';

// Connection Setup
const connectToNotifications = (serverUrl, jwtToken) => {
  const socket = io(`${serverUrl}/notifications`, {
    auth: {
      token: jwtToken
    }
  });

  // Connection Events
  socket.on('connect', () => {
    console.log('Connected to notification service');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from notification service');
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
  });

  // Setup Notification Listeners
  setupNotificationListeners(socket);

  return socket;
};

// Notification Listeners
const setupNotificationListeners = (socket) => {
  // Listen for new notifications
  socket.on('notification:created', (notification) => {
    console.log('New notification received:', notification);
    
    // Show notification to user (browser notification, UI toast, etc.)
    if (notification.importance >= 2) { // HIGH or CRITICAL
      showBrowserNotification(notification.title, notification.body);
    }
    
    // Update notification list in UI
    updateNotificationList(notification);
  });

  // Listen for delivery status updates
  socket.on('notification:delivered', (delivery) => {
    console.log('Notification delivery status:', delivery);
  });

  // Listen for preferences updates
  socket.on('preferences:updated', (update) => {
    console.log('Notification preferences updated:', update);
    // Refresh notification preferences UI
    fetchNotificationPreferences();
  });
};

// Notification Actions
const notificationActions = {
  // Get user notifications
  getNotifications: (socket, options = {}) => {
    return new Promise((resolve, reject) => {
      socket.emit('getNotifications', options, (response) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Failed to fetch notifications'));
        }
      });
    });
  },

  // Mark notifications as read
  markAsRead: (socket, notificationIds = []) => {
    return new Promise((resolve, reject) => {
      socket.emit('markAsRead', { notificationIds }, (response) => {
        if (response.success) {
          resolve(true);
        } else {
          reject(new Error(response.error || 'Failed to mark notifications as read'));
        }
      });
    });
  },

  // Mark all notifications as read
  markAllAsRead: (socket) => {
    return notificationActions.markAsRead(socket, []);
  },

  // Update notification preferences
  updatePreferences: (socket, preferences = {}) => {
    return new Promise((resolve, reject) => {
      socket.emit('updatePreferences', preferences, (response) => {
        if (response.success) {
          resolve(true);
        } else {
          reject(new Error(response.error || 'Failed to update preferences'));
        }
      });
    });
  },

  // Subscribe to topics
  subscribeToTopics: (socket, topics = []) => {
    return new Promise((resolve, reject) => {
      socket.emit('subscribe', topics, (response) => {
        if (response && response.success) {
          resolve(response.topics);
        } else {
          reject(new Error('Failed to subscribe to topics'));
        }
      });
    });
  },

  // Unsubscribe from topics
  unsubscribeFromTopics: (socket, topics = []) => {
    return new Promise((resolve, reject) => {
      socket.emit('unsubscribe', topics, (response) => {
        if (response && response.success) {
          resolve(response.topics);
        } else {
          reject(new Error('Failed to unsubscribe from topics'));
        }
      });
    });
  }
};

// Helper Functions
const showBrowserNotification = (title, body) => {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    });
  }
};

const updateNotificationList = (notification) => {
  // Example implementation - would be integrated with your UI framework
  const notificationsList = document.getElementById('notifications-list');
  if (notificationsList) {
    const notificationElement = document.createElement('div');
    notificationElement.className = `notification ${notification.read ? 'read' : 'unread'}`;
    notificationElement.innerHTML = `
      <h3>${notification.title}</h3>
      <p>${notification.body}</p>
      <span class="timestamp">${new Date(notification.createdAt).toLocaleString()}</span>
    `;
    notificationsList.prepend(notificationElement);
  }
};

const fetchNotificationPreferences = async () => {
  // Example - this would typically use your application's API
  try {
    const response = await fetch('/api/notification-preferences');
    const preferences = await response.json();
    // Update UI with preferences
    updatePreferencesUI(preferences);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
  }
};

const updatePreferencesUI = (preferences) => {
  // Example implementation - would be integrated with your UI framework
  const preferencesContainer = document.getElementById('notification-preferences');
  if (preferencesContainer) {
    // Update UI elements based on preferences
  }
};

// Export functions for use in application
export {
  connectToNotifications,
  notificationActions
};