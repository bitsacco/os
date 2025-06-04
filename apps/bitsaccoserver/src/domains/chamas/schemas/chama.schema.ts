import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export interface ChamaMember {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  status: 'active' | 'inactive' | 'suspended';
  contributionAmount?: number;
  nextContributionDate?: Date;
}

@Schema({ timestamps: true })
export class Chama extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  ownerId: string;

  @Prop({ type: [Object], default: [] })
  members: ChamaMember[];

  @Prop({ required: true, min: 0 })
  targetAmount: number;

  @Prop({ required: true, enum: ['KES', 'USD', 'BTC'] })
  currency: string;

  @Prop({ required: true, min: 2, max: 100 })
  memberLimit: number;

  @Prop({ enum: ['daily', 'weekly', 'monthly'], default: 'monthly' })
  contributionFrequency: string;

  @Prop({ required: true, min: 0 })
  contributionAmount: number;

  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ type: Date })
  endDate?: Date;

  @Prop({
    enum: ['draft', 'active', 'completed', 'cancelled', 'suspended'],
    default: 'draft',
  })
  status: string;

  @Prop({ default: 0 })
  currentAmount: number;

  @Prop({ type: Object })
  rules?: {
    allowEarlyWithdrawal: boolean;
    penaltyPercentage: number;
    quorumPercentage: number;
    votingPeriodHours: number;
  };

  @Prop({ type: Object })
  metadata?: {
    inviteCode?: string;
    isPublic: boolean;
    category?: string;
    tags?: string[];
  };

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ChamaSchema = SchemaFactory.createForClass(Chama);

// Indexes
ChamaSchema.index({ ownerId: 1 });
ChamaSchema.index({ 'members.userId': 1 });
ChamaSchema.index({ status: 1 });
ChamaSchema.index({ currency: 1 });
ChamaSchema.index({ createdAt: -1 });
ChamaSchema.index({ 'metadata.inviteCode': 1 }, { sparse: true });

// Virtual for member count
ChamaSchema.virtual('memberCount').get(function () {
  return this.members?.length || 0;
});

// Virtual for progress percentage
ChamaSchema.virtual('progressPercentage').get(function () {
  if (!this.targetAmount || this.targetAmount === 0) return 0;
  return Math.min((this.currentAmount / this.targetAmount) * 100, 100);
});

// Transform output
ChamaSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

ChamaSchema.set('toObject', { virtuals: true });
