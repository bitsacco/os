import { v4 as uuidv4 } from 'uuid';
import { SchemaTypes } from 'mongoose';
import { Prop, Schema } from '@nestjs/mongoose';

@Schema()
export class AbstractDocument {
  @Prop({ type: SchemaTypes.String, default: () => uuidv4() })
  _id: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}
