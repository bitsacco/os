import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';
import {
  fedimint_receive_success,
  fedimint_receive_failure,
  swap_status_change,
  collection_for_shares,
  notification_created,
  notification_delivered,
  notification_preferences_updated,
  type FedimintReceiveFailureEvent,
  type FedimintReceiveSuccessEvent,
  type SwapStatusChangeEvent,
  type WalletTxEvent,
  NotificationChannel,
  NotificationImportance,
  NotificationTopic,
  extractUserIdFromEvent,
} from '@bitsacco/common';
import { NotificationMetrics } from './notification.metrics';
import { RateLimitService } from './ratelimit';
import {
  NotificationRepository,
  NotificationPreferencesRepository,
} from './db';
import { SmsService } from '../sms/sms.service';
import { NostrService } from '../nostr/nostr.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notifications: NotificationRepository,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly metrics: NotificationMetrics,
    private readonly rateLimitService: RateLimitService,
    private readonly eventEmitter: EventEmitter2,
    private readonly smsService: SmsService,
    private readonly nostrService: NostrService,
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
    this.eventEmitter.emit(notification_preferences_updated, { userId });

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
    this.eventEmitter.emit(notification_created, {
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
        importance,
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
    importance: NotificationImportance = NotificationImportance.MEDIUM,
  ): Promise<boolean> {
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;

    try {
      // Apply rate limiting
      const rateLimit = this.rateLimitService.checkRateLimit(
        userId,
        channel,
        importance,
      );

      // Check if rate limited
      const rateLimitResult = await rateLimit;
      if (!rateLimitResult.allowed) {
        this.logger.warn(
          `Rate limit exceeded for user ${userId} on channel ${NotificationChannel[channel]}. ` +
            `Next allowed in ${Math.ceil(rateLimitResult.retryAfterMs / 1000)} seconds`,
        );

        errorMessage = `Rate limit exceeded. Retry after ${Math.ceil(rateLimitResult.retryAfterMs / 1000)} seconds`;

        // For IN_APP notifications, we'll store them anyway but mark them as filtered by rate limit
        // This ensures the user can still see them in their notification center
        if (channel === NotificationChannel.IN_APP) {
          // Mark as delivered with special handling
          await this.notifications.addDeliveryChannel(notificationId, channel);

          // We consider this a "success" for in-app, so the notification will be stored
          // but we won't count it as successfully delivered in metrics
          success = true;
        }

        return false;
      }

      switch (channel) {
        case NotificationChannel.IN_APP:
          // In-app notifications are stored in DB and don't need additional delivery
          success = true;
          break;

        case NotificationChannel.SMS:
          // Deliver via SMS service
          await this.smsService.sendSms({
            message: `${title}\n${body}`,
            receiver: userId, // Assuming userId is the phone number or can be resolved
          });
          success = true;
          break;

        case NotificationChannel.NOSTR:
          // Deliver via Nostr service
          await this.nostrService.sendEncryptedDirectMessage({
            message: `${title}\n${body}`,
            recipient: { npub: '', pubkey: userId }, // Assuming userId is the nostr pubkey
            retry: true,
          });
          success = true;
          break;
      }

      if (success) {
        // Mark as delivered in the notification record
        await this.notifications.addDeliveryChannel(notificationId, channel);
      }
    } catch (error) {
      errorMessage = error.message || 'Delivery failed';
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
    this.eventEmitter.emit(notification_delivered, {
      notificationId,
      userId,
      channel,
      success,
      error: success ? undefined : errorMessage || 'Delivery failed',
    });

    return success;
  }

  /**
   * Handle Fedimint receive success event
   */
  @OnEvent(fedimint_receive_success)
  private async handleFedimintSuccess(event: FedimintReceiveSuccessEvent) {
    const { operationId, context } = event;
    this.logger.log(
      `Received fedimint success event for operation: ${operationId}, context: ${context}`,
    );

    // Extract userId using the utility
    const userId = extractUserIdFromEvent(event);
    if (!userId) {
      this.logger.error(
        `Could not extract valid user ID from Fedimint success event: ${JSON.stringify(event)}`,
      );
      return;
    }

    // Create a notification based on the context
    await this.sendNotification(
      userId,
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
  private async handleFedimintFailure(event: FedimintReceiveFailureEvent) {
    const { operationId, context, error } = event;
    this.logger.log(
      `Received fedimint failure event for operation: ${operationId}, context: ${context}`,
    );

    // Extract userId using the utility
    const userId = extractUserIdFromEvent(event);
    if (!userId) {
      this.logger.error(
        `Could not extract valid user ID from Fedimint failure event: ${JSON.stringify(event)}`,
      );
      return;
    }

    await this.sendNotification(
      userId,
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
  private async handleSwapStatusChange(event: SwapStatusChangeEvent) {
    const { context, payload, error } = event;
    const { swapTracker, swapStatus, refundable } = payload;

    this.logger.log(
      `Received swap status change event for tracker: ${swapTracker}, status: ${swapStatus}`,
    );

    // Extract userId using the utility
    const userId = extractUserIdFromEvent(event);
    if (!userId) {
      this.logger.error(
        `Could not extract valid user ID from swap status change event: ${JSON.stringify(event)}`,
      );
      return;
    }

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
      userId,
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
  private async handleCollectionForShares(event: WalletTxEvent) {
    const { context, payload, error } = event;
    const { paymentTracker, paymentStatus } = payload;

    this.logger.log(
      `Received collection for shares event for tracker: ${paymentTracker}, status: ${paymentStatus}`,
    );

    // Extract userId using the utility
    const userId = extractUserIdFromEvent(event);
    if (!userId) {
      this.logger.error(
        `Could not extract valid user ID from collection for shares event: ${JSON.stringify(event)}`,
      );
      return;
    }

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
      userId,
      title,
      body,
      NotificationTopic.SHARES,
      { paymentTracker, status: paymentStatus, context, error }, // Metadata
      importance,
    );
  }
}
