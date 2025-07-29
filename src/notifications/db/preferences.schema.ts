import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  AbstractDocument,
  NotificationChannel,
  NotificationTopic,
} from '../../common';

@Schema({ versionKey: false })
export class NotificationPreferencesDocument extends AbstractDocument {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({
    type: Map,
    of: Boolean,
    default: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.SMS]: true,
      [NotificationChannel.NOSTR]: true,
    },
  })
  channelPreferences: Map<string, boolean>;

  @Prop({
    type: Map,
    of: Object,
    default: {
      [NotificationTopic.TRANSACTION]: {
        enabled: true,
        channels: [
          NotificationChannel[NotificationChannel.IN_APP],
          NotificationChannel[NotificationChannel.SMS],
          NotificationChannel[NotificationChannel.NOSTR],
        ],
      },
      [NotificationTopic.SECURITY]: {
        enabled: true,
        channels: [
          NotificationChannel[NotificationChannel.IN_APP],
          NotificationChannel[NotificationChannel.SMS],
          NotificationChannel[NotificationChannel.NOSTR],
        ],
      },
      [NotificationTopic.SYSTEM]: {
        enabled: true,
        channels: [NotificationChannel[NotificationChannel.IN_APP]],
      },
      [NotificationTopic.SWAP]: {
        enabled: true,
        channels: [
          NotificationChannel[NotificationChannel.IN_APP],
          NotificationChannel[NotificationChannel.SMS],
        ],
      },
      [NotificationTopic.SHARES]: {
        enabled: true,
        channels: [
          NotificationChannel[NotificationChannel.IN_APP],
          NotificationChannel[NotificationChannel.SMS],
        ],
      },
      [NotificationTopic.CHAMA]: {
        enabled: true,
        channels: [
          NotificationChannel[NotificationChannel.IN_APP],
          NotificationChannel[NotificationChannel.SMS],
        ],
      },
    },
  })
  topicPreferences: Map<string, { enabled: boolean; channels: string[] }>;
}

export const NotificationPreferencesSchema = SchemaFactory.createForClass(
  NotificationPreferencesDocument,
);
