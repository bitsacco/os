export enum MpesaTransactionState {
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Retry = 'RETRY',
  Failed = 'FAILED',
  Complete = 'COMPLETE',
}

export enum BatchPaymentStatusCode {
  // New batch or request, reading in progress
  BP101 = 'BP101',
  // Batch/request waiting approval
  BP103 = 'BP103',
  // Queued to check for float balance
  BP104 = 'BP104',
  // Float/balance check in progress
  BP106 = 'BP106',
  // Advance internal validations in progress
  BP108 = 'BP108',
  // Payment to beneficiary in progress
  BP109 = 'BP109',
  // Sending payments to beneficiary in progress
  BP110 = 'BP110',
  // 	Batch/request failed
  BF102 = 'BF102',
  // Failed checking float balance
  BF105 = 'BF105',
  // Failed advance float check issue
  BF107 = 'BF107',
  // Completed sending all transactions. Results ready for review
  BC100 = 'BC100',
  // Batch/request ended or cancelled early
  BE111 = 'BE111',
}

export enum PaymentStatusCode {
  // New transaction. Processing is pending
  TP101 = 'TP101',
  // Transaction processing started
  TP102 = 'TP102',
  // Failed to initiate or process transaction. Check failed reason for more details
  TF103 = 'TF103',
  // Transaction results processing in progress
  TF104 = 'TF104',
  // Transaction status cannot be determined. Contact support for further check.
  TF105 = 'TF105',
  // Transaction failed, see failed reasons for more details
  TF106 = 'TF106',
  // Transaction is successful
  TS100 = 'TS100',
  // Transaction is under observation
  TH107 = 'TH107',
  // Transaction canceled
  TC108 = 'TC108',
  // Transaction is queued for retry
  TR109 = 'TR109',
}

export interface MpesaInvoice {
  invoice_id: string;
  state: MpesaTransactionState;
  api_ref: string;
  value: string;
  charges: string;
  net_amount: string;
  currency: string;
  account: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface IntasendPayment {
  status: string;
  status_code: PaymentStatusCode;
  request_reference_id: string;
  name: string;
  account: string;
  id_number: string | null;
  bank_code: string | null;
  amount: number;
  narrative: string;
}

export interface MpesaCollectionUpdate {
  invoice_id: string;
  state: MpesaTransactionState;
  failed_reason: string | null;
  challenge: string;
}

export interface MpesaPaymentUpdate {
  file_id: string;
  status: string;
  status_code: BatchPaymentStatusCode;
  transactions: IntasendPayment[];
}

export interface MpesaTracker {
  id: string;
  state: MpesaTransactionState;
}
