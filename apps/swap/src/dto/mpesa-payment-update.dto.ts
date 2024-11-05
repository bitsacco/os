import {
  IsEnum,
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import {
  BatchPaymentStatusCode,
  type IntasendPayment,
  MpesaTransactionState,
  MpesaPaymentUpdate,
  PaymentStatusCode,
} from '../intasend/intasend.types';

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
