import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { AbstractRepository } from '../../common';
import { ChannelPreference, TopicPreference } from '../../common';
import { NotificationPreferencesDocument } from './preferences.schema';

@Injectable()
export class NotificationPreferencesRepository extends AbstractRepository<NotificationPreferencesDocument> {
  protected readonly logger: Logger;

  constructor(
    @InjectModel(NotificationPreferencesDocument.name)
    private readonly preferencesModel: Model<NotificationPreferencesDocument>,
  ) {
    super(preferencesModel);
  }

  async findByUserId(
    userId: string,
  ): Promise<NotificationPreferencesDocument | null> {
    return this.preferencesModel.findOne({ userId }).exec();
  }

  async getOrCreatePreferences(
    userId: string,
  ): Promise<NotificationPreferencesDocument> {
    let preferences = await this.findByUserId(userId);

    if (!preferences) {
      // Create default preferences
      preferences = await this.preferencesModel.create({ userId });
    }

    return preferences;
  }

  async updatePreferences(
    userId: string,
    channelPreferences?: ChannelPreference[],
    topicPreferences?: TopicPreference[],
  ): Promise<NotificationPreferencesDocument> {
    const pd = await this.getOrCreatePreferences(userId);

    // Update channel preferences
    if (channelPreferences && channelPreferences.length > 0) {
      channelPreferences.forEach((pref) => {
        pd.channelPreferences.set(String(pref.channel), pref.enabled);
      });
    }

    // Update topic preferences
    if (topicPreferences && topicPreferences.length > 0) {
      topicPreferences.forEach((pref) => {
        const channels = pref.channels.map((channel) => String(channel));

        pd.topicPreferences.set(String(pref.topic), {
          enabled: pref.enabled,
          channels,
        });
      });
    }

    return await this.findOneAndUpdate({ _id: pd._id }, pd);
  }

  async isChannelEnabledForTopic(
    userId: string,
    topic: number,
    channel: number,
  ): Promise<boolean> {
    const preferences = await this.getOrCreatePreferences(userId);

    // First check if channel is globally enabled
    const isChannelEnabled =
      preferences.channelPreferences.get(String(channel)) || false;
    if (!isChannelEnabled) return false;

    // Then check if topic is enabled
    const topicPref = preferences.topicPreferences.get(String(topic));
    if (!topicPref || !topicPref.enabled) return false;

    // Finally check if channel is enabled for this topic
    return topicPref.channels.includes(String(channel));
  }
}
