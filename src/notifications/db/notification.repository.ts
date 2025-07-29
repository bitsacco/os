import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import {
  AbstractRepository,
  NotificationChannel,
  NotificationTopic,
} from '../../common';
import { NotificationDocument } from './notification.schema';

@Injectable()
export class NotificationRepository extends AbstractRepository<NotificationDocument> {
  protected readonly logger: Logger;

  constructor(
    @InjectModel(NotificationDocument.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {
    super(notificationModel);
  }

  async findByUserId(
    userId: string,
    options: {
      unreadOnly?: boolean;
      topics?: NotificationTopic[];
      page?: number;
      size?: number;
    } = {},
  ) {
    const { unreadOnly = false, topics = [], page = 0, size = 10 } = options;

    const query: Record<string, any> = { userId };

    if (unreadOnly) {
      query.read = false;
    }

    if (topics && topics.length > 0) {
      query.topic = { $in: topics };
    }

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(page * size)
        .limit(size)
        .exec(),
      this.notificationModel.countDocuments(query).exec(),
    ]);

    return { notifications, total, page, size };
  }

  async markAsRead(userId: string, notificationIds?: string[]) {
    const query: Record<string, any> = { userId };

    if (notificationIds && notificationIds.length > 0) {
      query._id = { $in: notificationIds };
    }

    return this.notificationModel
      .updateMany(query, { $set: { read: true } })
      .exec();
  }

  async addDeliveryChannel(id: string, channel: NotificationChannel) {
    return this.notificationModel
      .updateOne(
        { _id: id },
        { $addToSet: { deliveredTo: NotificationChannel[channel] } },
      )
      .exec();
  }
}
