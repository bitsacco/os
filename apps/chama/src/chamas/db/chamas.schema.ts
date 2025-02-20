import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  AbstractDocument,
  type ChamaMember,
  type Chama,
  ChamaMemberRole,
} from '@bitsacco/common';

@Schema()
class ChamaMemberDocument extends AbstractDocument implements ChamaMember {
  @Prop({
    index: true,
    required: true,
  })
  userId: string;

  @Prop({
    type: [{ type: String, enum: Object.values(ChamaMemberRole) }],
    required: true,
    validate: {
      validator: (roles: ChamaMemberRole[]) => roles.length > 0,
      message: 'Member must have at least one role',
    },
  })
  roles: ChamaMemberRole[];
}

@Schema({ versionKey: false })
export class ChamasDocument
  extends AbstractDocument
  implements Omit<Chama, 'id'>
{
  @Prop({
    type: String,
    required: true,
  })
  name: string;

  @Prop({
    type: String,
    required: false,
  })
  description?: string;

  @Prop({
    type: [ChamaMemberDocument],
    required: true,
  })
  members: ChamaMember[];

  @Prop({
    type: String,
    required: true,
  })
  createdBy: string;
}

export const ChamasSchema = SchemaFactory.createForClass(ChamasDocument);

export function toChama(doc: ChamasDocument): Chama {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description,
    members: doc.members,
    createdBy: doc.createdBy,
  };
}
