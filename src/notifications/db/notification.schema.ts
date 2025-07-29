import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  AbstractDocument,
  NotificationImportance,
  NotificationTopic,
} from '../../common';

@Schema({ versionKey: false })
export class NotificationDocument extends AbstractDocument {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ required: true, type: Number, enum: NotificationTopic })
  topic: NotificationTopic;

  @Prop({ default: false })
  read: boolean;

  @Prop({ type: Map, of: String, default: {} })
  metadata: Map<string, string>;

  @Prop({ required: true, type: Number, enum: NotificationImportance })
  importance: NotificationImportance;

  @Prop({ type: [String], default: [] })
  deliveredTo: string[];
}

export const NotificationSchema =
  SchemaFactory.createForClass(NotificationDocument);
