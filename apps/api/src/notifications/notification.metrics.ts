import { Injectable } from '@nestjs/common';
import { createMeter } from '@bitsacco/common';
import { NotificationChannel, NotificationTopic } from '@bitsacco/common';

@Injectable()
export class NotificationMetrics {
  private readonly meter = createMeter('notification');
  private readonly notificationsCreatedCounter;
  private readonly notificationsDeliveredCounter;
  private readonly notificationsReadCounter;
  private readonly notificationDeliveryLatencyHistogram;
  private readonly preferencesUpdatedCounter;

  constructor() {
    // Notifications created
    this.notificationsCreatedCounter = this.meter.createCounter(
      'notification.created_total',
      {
        description: 'Total number of notifications created',
      },
    );

    // Notifications delivered by channel
    this.notificationsDeliveredCounter = this.meter.createCounter(
      'notification.delivered_total',
      {
        description: 'Total number of notifications delivered',
      },
    );

    // Notifications read
    this.notificationsReadCounter = this.meter.createCounter(
      'notification.read_total',
      {
        description: 'Total number of notifications marked as read',
      },
    );

    // Delivery latency
    this.notificationDeliveryLatencyHistogram = this.meter.createHistogram(
      'notification.delivery_latency',
      {
        description: 'Notification delivery latency in milliseconds',
      },
    );

    // Preferences updated
    this.preferencesUpdatedCounter = this.meter.createCounter(
      'notification.preferences_updated_total',
      {
        description: 'Total number of notification preferences updates',
      },
    );
  }

  /**
   * Record a notification creation
   */
  notificationCreated(topic: NotificationTopic, importance: number) {
    this.notificationsCreatedCounter.add(1, {
      topic: NotificationTopic[topic],
      importance: String(importance),
    });
  }

  /**
   * Record a notification delivery
   */
  notificationDelivered(
    channel: NotificationChannel,
    topic: NotificationTopic,
    success: boolean,
  ) {
    this.notificationsDeliveredCounter.add(1, {
      channel: NotificationChannel[channel],
      topic: NotificationTopic[topic],
      success: String(success),
    });
  }

  /**
   * Record notification delivery latency
   */
  recordDeliveryLatency(channel: NotificationChannel, latencyMs: number) {
    this.notificationDeliveryLatencyHistogram.record(latencyMs, {
      channel: NotificationChannel[channel],
    });
  }

  /**
   * Record a notification being marked as read
   */
  notificationRead(topic: NotificationTopic) {
    this.notificationsReadCounter.add(1, {
      topic: NotificationTopic[topic],
    });
  }

  /**
   * Record preferences update
   */
  preferencesUpdated() {
    this.preferencesUpdatedCounter.add(1);
  }
}
