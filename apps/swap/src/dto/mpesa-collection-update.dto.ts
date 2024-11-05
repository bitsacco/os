import { IsEnum, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import {
  MpesaTransactionState,
  type MpesaCollectionUpdate,
} from '../intasend/intasend.types';

export class MpesaCollectionUpdateDto implements MpesaCollectionUpdate {
  @IsNotEmpty()
  @IsString()
  invoice_id: string;

  @IsEnum(MpesaTransactionState)
  state: MpesaTransactionState;

  @IsOptional()
  @IsString()
  failed_reason: string | null;

  @IsNotEmpty()
  @IsString()
  challenge: string;
}
