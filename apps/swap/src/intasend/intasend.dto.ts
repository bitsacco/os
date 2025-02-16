import { Transform, Type } from 'class-transformer';
import { IsStringifiedNumberConstraint } from '@bitsacco/common';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Length,
  Validate,
  Min,
} from 'class-validator';
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
}

export class MpesaPaymentUpdateDto implements MpesaPaymentUpdate {
  @IsNotEmpty()
  @IsString()
  file_id: string;

  @IsNotEmpty()
  @IsString()
  status: string;

  @IsEnum(MpesaTransactionState)
  status_code: BatchPaymentStatusCode;

  @IsNotEmpty()
  transactions: IntasendPayment[];

  @IsNotEmpty()
  @IsString()
  challenge: string;
}

export class IntasendPaymentDto implements IntasendPayment {
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
  name: string;

  @IsNotEmpty()
  @IsString()
  account: string;

  @IsOptional()
  @IsString()
  id_number: string | null;

  @IsOptional()
  @IsString()
  bank_code: string | null;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsString()
  narrative: string;
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
