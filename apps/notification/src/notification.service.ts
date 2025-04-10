import { OnEvent } from '@nestjs/event-emitter';
import { ClientProxy } from '@nestjs/microservices';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EVENTS_SERVICE_BUS,
  NOSTR_SERVICE_NAME,
  SMS_SERVICE_NAME,
  fedimint_receive_success,
  fedimint_receive_failure,
  swap_status_change,
  collection_for_shares,
  notification_created,
  notification_delivered,
  notification_preferences_updated,
  type FedimintReceiveFailureEvent,
  type NotificationCreatedEvent,
  type NotificationDeliveredEvent,
  type FedimintReceiveSuccessEvent,
  type SwapStatusChangeEvent,
  type WalletTxEvent,
  NotificationChannel,
  NotificationImportance,
  NotificationTopic,
} from '@bitsacco/common';
import { NotificationMetrics } from './notification.metrics';
import {
  NotificationRepository,
  NotificationPreferencesRepository,
} from './db';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notifications: NotificationRepository,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly metrics: NotificationMetrics,
    @Inject(EVENTS_SERVICE_BUS) private readonly eventsClient: ClientProxy,
    @Inject(SMS_SERVICE_NAME) private readonly smsClient: ClientProxy,
    @Inject(NOSTR_SERVICE_NAME) private readonly nostrClient: ClientProxy,
  ) {}

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string) {
    const dts = await this.preferences.getOrCreatePreferences(userId);

    // Convert from DB model to API response
    const channels = [];
    const topics = [];

    // Convert channel preferences
    for (const [channelKey, enabled] of dts.channelPreferences.entries()) {
      channels.push({
        channel: Number(channelKey),
        enabled,
      });
    }

    // Convert topic preferences
    for (const [topicKey, pref] of dts.topicPreferences.entries()) {
      topics.push({
        topic: Number(topicKey),
        enabled: pref.enabled,
        channels: pref.channels.map((c) => Number(c)),
      });
    }

    return {
      userId,
      channels,
      topics,
    };
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(userId: string, channels = [], topics = []) {
    await this.preferences.updatePreferences(userId, channels, topics);

    this.metrics.preferencesUpdated();

    // Emit event for other services
    this.eventsClient.emit(notification_preferences_updated, { userId });

    return {};
  }

  /**
   * Get user notifications
   */
  async getNotifications(
    userId: string,
    unreadOnly = false,
    pagination = { page: 0, size: 10 },
    topics = [],
  ) {
    const {
      notifications: dts,
      total,
      page,
      size,
    } = await this.notifications.findByUserId(userId, {
      unreadOnly,
      topics,
      page: pagination.page,
      size: pagination.size,
    });

    const result = dts.map((notification) => ({
      id: notification._id.toString(),
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      topic: notification.topic,
      read: notification.read,
      createdAt: notification.createdAt.getTime(),
      metadata: Object.fromEntries(notification.metadata) || {},
      importance: notification.importance,
    }));

    return {
      notifications: result,
      total,
      page,
      size,
    };
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId: string, notificationIds = []) {
    const { modifiedCount } = await this.notifications.markAsRead(
      userId,
      notificationIds,
    );

    this.logger.log(
      `Marked ${modifiedCount} notifications as read for user ${userId}`,
    );

    // If specific IDs were provided, get them to update metrics by topic
    if (notificationIds && notificationIds.length > 0) {
      const dts = await this.notifications.find(notificationIds);
      dts.forEach((notification) => {
        this.metrics.notificationRead(notification.topic);
      });
    }

    return {};
  }

  /**
   * Send a notification
   */
  async sendNotification(
    userId: string,
    title: string,
    body: string,
    topic: NotificationTopic,
    metadata = {},
    importance = NotificationImportance.MEDIUM,
    channels: NotificationChannel[] = [],
  ) {
    // Create the notification in DB
    const dt = await this.notifications.create({
      userId,
      title,
      body,
      topic,
      metadata: new Map(Object.entries(metadata)),
      importance,
      read: false,
      deliveredTo: [],
    });

    const notificationId = dt._id.toString();
    this.metrics.notificationCreated(topic, importance);

    // Emit notification created event
    this.eventsClient.emit<NotificationCreatedEvent>(notification_created, {
      notificationId,
      userId,
      title,
      body,
      topic,
      importance,
      channels,
      metadata,
    });

    // If no specific channels, determine which channels to use based on preferences
    const deliveryChannels =
      channels.length > 0
        ? channels
        : await this.determineChannelsForDelivery(userId, topic);

    // Deliver to each channel in parallel
    const deliveryPromises = deliveryChannels.map((channel) =>
      this.deliverToChannel(
        notificationId,
        userId,
        title,
        body,
        topic,
        channel,
      ),
    );

    const deliveryResults = await Promise.allSettled(deliveryPromises);
    const deliveredTo = [];

    deliveryResults.forEach((result, index) => {
      const channel = deliveryChannels[index];
      if (result.status === 'fulfilled' && result.value) {
        deliveredTo.push(channel);
      }
    });

    return {
      notificationId,
      deliveredTo,
    };
  }

  /**
   * Determine which channels to use for delivery based on user preferences
   */
  private async determineChannelsForDelivery(
    userId: string,
    topic: NotificationTopic,
  ): Promise<NotificationChannel[]> {
    const channels = [];

    // Check each channel
    if (
      await this.preferences.isChannelEnabledForTopic(
        userId,
        topic,
        NotificationChannel.IN_APP,
      )
    ) {
      channels.push(NotificationChannel.IN_APP);
    }

    if (
      await this.preferences.isChannelEnabledForTopic(
        userId,
        topic,
        NotificationChannel.SMS,
      )
    ) {
      channels.push(NotificationChannel.SMS);
    }

    if (
      await this.preferences.isChannelEnabledForTopic(
        userId,
        topic,
        NotificationChannel.NOSTR,
      )
    ) {
      channels.push(NotificationChannel.NOSTR);
    }

    return channels;
  }

  /**
   * Deliver notification to a specific channel
   */
  private async deliverToChannel(
    notificationId: string,
    userId: string,
    title: string,
    body: string,
    topic: NotificationTopic,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const startTime = Date.now();
    let success = false;

    try {
      switch (channel) {
        case NotificationChannel.IN_APP:
          // In-app notifications are stored in DB and don't need additional delivery
          success = true;
          break;

        case NotificationChannel.SMS:
          // Deliver via SMS service
          await this.smsClient
            .send('SendSms', {
              userId,
              message: `${title}\n${body}`,
            })
            .toPromise();
          success = true;
          break;

        case NotificationChannel.NOSTR:
          // Deliver via Nostr service
          await this.nostrClient
            .send('SendDirectMessage', {
              userId,
              content: `${title}\n${body}`,
            })
            .toPromise();
          success = true;
          break;
      }

      if (success) {
        // Mark as delivered in the notification record
        await this.notifications.addDeliveryChannel(notificationId, channel);
      }
    } catch (error) {
      this.logger.error(
        `Failed to deliver notification ${notificationId} to channel ${NotificationChannel[channel]}`,
        error.stack,
      );
      success = false;
    }

    // Record metrics
    const latencyMs = Date.now() - startTime;
    this.metrics.recordDeliveryLatency(channel, latencyMs);
    this.metrics.notificationDelivered(channel, topic, success);

    // Emit delivery event
    this.eventsClient.emit<NotificationDeliveredEvent>(notification_delivered, {
      notificationId,
      userId,
      channel,
      success,
      error: success ? undefined : 'Delivery failed',
    });

    return success;
  }

  /**
   * Handle Fedimint receive success event
   */
  @OnEvent(fedimint_receive_success)
  private async handleFedimintSuccess({
    operationId,
    context,
  }: FedimintReceiveSuccessEvent) {
    this.logger.log(
      `Received fedimint success event for operation: ${operationId}, context: ${context}`,
    );

    // Create a notification based on the context
    await this.sendNotification(
      operationId, // Using operationId as userId - will need to be adjusted with actual user ID
      'Payment Received',
      'Your payment has been successfully received',
      NotificationTopic.TRANSACTION,
      { operationId, context }, // Metadata
      NotificationImportance.HIGH,
    );
  }

  /**
   * Handle Fedimint receive failure event
   */
  @OnEvent(fedimint_receive_failure)
  private async handleFedimintFailure({
    operationId,
    context,
    error,
  }: FedimintReceiveFailureEvent) {
    this.logger.log(
      `Received fedimint failure event for operation: ${operationId}, context: ${context}`,
    );

    await this.sendNotification(
      operationId, // Using operationId as userId - will need to be adjusted with actual user ID
      'Payment Failed',
      `Your payment could not be processed: ${error || 'Unknown error'}`,
      NotificationTopic.TRANSACTION,
      { operationId, context, error }, // Metadata
      NotificationImportance.HIGH,
    );
  }

  /**
   * Handle swap status change event
   */
  @OnEvent(swap_status_change)
  private async handleSwapStatusChange({
    context,
    payload,
    error,
  }: SwapStatusChangeEvent) {
    const { swapTracker, swapStatus, refundable } = payload;
    this.logger.log(
      `Received swap status change event for tracker: ${swapTracker}, status: ${swapStatus}`,
    );

    let title = 'Swap Status Update';
    let body = 'Your swap transaction status has changed';
    let importance = NotificationImportance.MEDIUM;

    switch (swapStatus) {
      case 0: // PENDING
        body = 'Your swap transaction is pending';
        break;
      case 1: // PROCESSING
        body = 'Your swap transaction is being processed';
        break;
      case 2: // FAILED
        title = 'Swap Failed';
        body = `Your swap transaction has failed${refundable ? ' and is eligible for refund' : ''}`;
        importance = NotificationImportance.HIGH;
        break;
      case 3: // COMPLETE
        title = 'Swap Complete';
        body = 'Your swap transaction has been completed successfully';
        importance = NotificationImportance.HIGH;
        break;
    }

    await this.sendNotification(
      swapTracker, // Using swapTracker as userId - will need to be adjusted with actual user ID
      title,
      body,
      NotificationTopic.SWAP,
      { swapTracker, status: swapStatus, context, refundable, error }, // Metadata
      importance,
    );
  }

  /**
   * Handle collection for shares event
   */
  @OnEvent(collection_for_shares)
  private async handleCollectionForShares({
    context,
    payload,
    error,
  }: WalletTxEvent) {
    const { paymentTracker, paymentStatus } = payload;
    this.logger.log(
      `Received collection for shares event for tracker: ${paymentTracker}, status: ${paymentStatus}`,
    );

    let title = 'Shares Collection Update';
    let body = 'Your shares collection status has changed';
    let importance = NotificationImportance.MEDIUM;

    switch (paymentStatus) {
      case 0: // PENDING
        body = 'Your shares collection is pending';
        break;
      case 1: // PROCESSING
        body = 'Your shares collection is being processed';
        break;
      case 2: // FAILED
        title = 'Shares Collection Failed';
        body = 'Your shares collection has failed';
        importance = NotificationImportance.HIGH;
        break;
      case 3: // COMPLETE
        title = 'Shares Collection Complete';
        body = 'Your shares collection has been completed successfully';
        importance = NotificationImportance.HIGH;
        break;
    }

    await this.sendNotification(
      paymentTracker, // Using paymentTracker as userId - will need to be adjusted with actual user ID
      title,
      body,
      NotificationTopic.SHARES,
      { paymentTracker, status: paymentStatus, context, error }, // Metadata
      importance,
    );
  }
}
