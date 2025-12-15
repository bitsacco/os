import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Length,
  Validate,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsStringifiedNumberConstraint } from '../../common';
import {
  BatchPaymentStatusCode,
  PaymentStatusCode,
  MpesaTransactionState,
  type IntasendPayment,
  type MpesaCollectionUpdate,
  type MpesaPaymentUpdate,
} from './intasend.types';

export class SendSTKPushDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @NormalizePhoneNumber()
  @IsString()
  @Length(12, 12)
  phone_number: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  api_ref: string;
}

export class SendMpesaDto {
  @IsNotEmpty()
  @IsString()
  @Validate(IsStringifiedNumberConstraint)
  @Type(() => String)
  amount: string;

  @NormalizePhoneNumber()
  @IsString()
  @Length(12, 12)
  account: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  name: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  narrative: string;
}

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

  @IsNotEmpty()
  @IsString()
  updated_at: string;
}

export class MpesaPaymentUpdateDto implements MpesaPaymentUpdate {
  @IsNotEmpty()
  @IsString()
  file_id: string;

  @IsNotEmpty()
  @IsString()
  status: string;

  @IsEnum(BatchPaymentStatusCode)
  status_code: BatchPaymentStatusCode;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntasendPaymentDto)
  transactions: IntasendPayment[];

  @IsNotEmpty()
  @IsString()
  actual_charges: string;

  @IsNotEmpty()
  @IsString()
  paid_amount: string;

  @IsNotEmpty()
  @IsString()
  failed_amount: string;

  @IsNotEmpty()
  @IsString()
  charge_estimate: string;

  @IsNotEmpty()
  @IsString()
  total_amount_estimate: string;

  @IsNotEmpty()
  @IsString()
  total_amount: string;

  @IsNotEmpty()
  @IsNumber()
  transactions_count: number;

  @IsNotEmpty()
  @IsString()
  challenge: string;
}

export class IntasendPaymentDto implements IntasendPayment {
  @IsNotEmpty()
  @IsString()
  transaction_id: string;

  @IsNotEmpty()
  @IsString()
  status: string;

  @IsEnum(PaymentStatusCode)
  status_code: PaymentStatusCode;

  @IsNotEmpty()
  @IsString()
  request_reference_id: string;

  @IsNotEmpty()
  @IsString()
  provider: string;

  @IsOptional()
  @IsString()
  bank_code: string | null;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  account: string;

  @IsOptional()
  @IsString()
  account_type: string | null;

  @IsOptional()
  @IsString()
  account_reference: string | null;

  @IsOptional()
  @IsString()
  provider_reference: string | null;

  @IsOptional()
  @IsString()
  provider_account_name: string | null;

  @IsNotEmpty()
  @IsString()
  amount: string;

  @IsNotEmpty()
  @IsString()
  charge: string;

  @IsOptional()
  @IsString()
  file_id: string | null;

  @IsNotEmpty()
  @IsString()
  narrative: string;

  @IsNotEmpty()
  @IsString()
  currency: string;
}

function NormalizePhoneNumber() {
  return Transform((params) => {
    const { value } = params;
    if (typeof value !== 'string') {
      return value;
    }

    let normalized = value.replace(/\D/g, '');

    if (normalized.length === 9) {
      normalized = '254' + normalized;
    } else if (normalized.startsWith('0')) {
      normalized = '254' + normalized.slice(1);
    } else if (!normalized.startsWith('254')) {
      normalized = '254' + normalized;
    }

    if (normalized.length !== 12) {
      throw new Error('Invalid phone number format');
    }

    return normalized;
  });
}

export const isMpesaCollectionUpdate = (
  update: MpesaCollectionUpdateDto | MpesaPaymentUpdateDto,
): update is MpesaCollectionUpdateDto => {
  return 'invoice_id' in update;
};

export const isMpesaPaymentUpdate = (
  update: MpesaCollectionUpdateDto | MpesaPaymentUpdateDto,
): update is MpesaPaymentUpdateDto => {
  return 'file_id' in update;
};
