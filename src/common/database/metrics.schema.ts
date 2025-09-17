import { Prop, Schema } from '@nestjs/mongoose';
import { AbstractDocument } from './abstract.schema';

export interface BaseMetricsDocument extends AbstractDocument {
  timestamp: Date;
  period: 'real-time' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  source: string;
  version: number;
}

@Schema({
  timestamps: true,
  collection: 'base_metrics',
  discriminatorKey: 'source',
})
export class BaseMetrics extends AbstractDocument {
  @Prop({ required: true, type: Date })
  timestamp: Date;

  @Prop({
    required: true,
    enum: ['real-time', 'hourly', 'daily', 'weekly', 'monthly'],
  })
  period: 'real-time' | 'hourly' | 'daily' | 'weekly' | 'monthly';

  @Prop({ required: true, type: String })
  source: string;

  @Prop({ required: true, type: Number, default: 1 })
  version: number;
}
