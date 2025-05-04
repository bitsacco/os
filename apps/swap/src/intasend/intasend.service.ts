import IntaSend = require('intasend-node');
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import {
  BatchPaymentStatusCode,
  MpesaTransactionState,
  MpesaTracker,
  PaymentStatusCode,
} from './intasend.types';
import {
  SendSTKPushDto,
  SendMpesaDto,
  MpesaCollectionUpdateDto,
  MpesaPaymentUpdateDto,
} from './intasend.dto';

@Injectable()
export class IntasendService {
  private readonly logger = new Logger(IntasendService.name);
  private intasend: IntaSend;

  constructor(private readonly configService: ConfigService) {
    this.logger.log('IntasendService created');

    const pubkey = this.configService.getOrThrow<string>('INTASEND_PUBLIC_KEY');
    const privkey = this.configService.getOrThrow<string>(
      'INTASEND_PRIVATE_KEY',
    );

    const test_mode = pubkey.includes('test') || privkey.includes('test');

    if (test_mode) {
      this.logger.log('IntasendService running in test mode');
    } else {
      this.logger.log('IntasendService running in production mode');
    }

    try {
      this.intasend = new IntaSend(pubkey, privkey, test_mode);
      this.logger.log('IntasendService initialized');
    } catch (e) {
      this.logger.error('IntasendService failed to initialize');
      throw e;
    }
  }

  async sendMpesaStkPush(payload: SendSTKPushDto): Promise<MpesaTracker> {
    this.logger.log(`Sending STK push to ${payload.phone_number}`);
    const resp = await this.intasend.collection().mpesaStkPush(payload);

    return {
      id: resp.invoice.invoice_id,
      state: MpesaTransactionState.Pending,
    };
  }

  async sendMpesaPayment(payload: SendMpesaDto): Promise<MpesaTracker> {
    this.logger.log(`Sending Mpesa payment to ${payload.account}`);
    const resp = await this.intasend.payouts().mpesa({
      currency: 'KES',
      requires_approval: 'NO',
      mobile_tarrif: 'CUSTOMER-PAYS',
      transactions: [{
        ...payload,
        mobile_tarrif: 'CUSTOMER-PAYS',
      }],
    });

    return {
      id: resp.file_id,
      state: MpesaTransactionState.Pending,
    };
  }

  async getMpesaTrackerFromCollectionUpdate({
    invoice_id,
    state,
    failed_reason,
    challenge,
  }: MpesaCollectionUpdateDto): Promise<MpesaTracker> {
    this.checkUpdateChallenge(challenge);

    if (failed_reason) {
      this.logger.error(`Mpesa transaction failed: ${failed_reason}`);
    }

    return {
      id: invoice_id,
      state,
    };
  }

  async getMpesaTrackerFromPaymentUpdate({
    file_id,
    status_code,
    transactions,
    challenge,
    transactions_count,
  }: MpesaPaymentUpdateDto): Promise<MpesaTracker> {
    this.checkUpdateChallenge(challenge);
    this.logger.log(
      `Processing payment update for file_id: ${file_id}, status_code: ${status_code}`,
    );

    let batch: MpesaTransactionState;
    switch (status_code) {
      case BatchPaymentStatusCode.BP101:
      case BatchPaymentStatusCode.BP103:
      case BatchPaymentStatusCode.BP104:
      case BatchPaymentStatusCode.BP106:
      case BatchPaymentStatusCode.BP108:
        batch = MpesaTransactionState.Pending;
        break;
      case BatchPaymentStatusCode.BP109:
      case BatchPaymentStatusCode.BP110:
        batch = MpesaTransactionState.Processing;
        break;
      case BatchPaymentStatusCode.BF102:
      case BatchPaymentStatusCode.BF105:
      case BatchPaymentStatusCode.BF107:
      case BatchPaymentStatusCode.BE111:
        batch = MpesaTransactionState.Failed;
        break;
      case BatchPaymentStatusCode.BC100:
        batch = MpesaTransactionState.Complete;
        break;
    }

    let state = batch; // Default to batch state if no individual transaction state is determined

    if (batch === MpesaTransactionState.Complete && transactions.length > 0) {
      this.logger.log(`Batch complete, checking individual transaction status`);

      if (transactions.length !== transactions_count) {
        this.logger.warn(
          `Expected 1 transaction, but got ${transactions.length}`,
        );
      }

      const tx = transactions[0];
      this.logger.log(
        `Transaction status: ${tx.status}, status_code: ${tx.status_code}`,
      );

      switch (tx.status_code) {
        case PaymentStatusCode.TP101:
        case PaymentStatusCode.TP102:
          this.logger.warn(
            'Transaction still shows as pending or processing despite batch being complete',
          );
          state = MpesaTransactionState.Processing;
          break;
        case PaymentStatusCode.TF103:
        case PaymentStatusCode.TF104:
        case PaymentStatusCode.TF105:
        case PaymentStatusCode.TF106:
        case PaymentStatusCode.TC108:
          state = MpesaTransactionState.Failed;
          break;
        case PaymentStatusCode.TS100:
          state = MpesaTransactionState.Complete;
          break;
        case PaymentStatusCode.TH107:
          state = MpesaTransactionState.Processing;
          break;
        case PaymentStatusCode.TR109:
          state = MpesaTransactionState.Processing;
          break;
        default:
          this.logger.warn(
            `Unknown transaction status code: ${tx.status_code}, defaulting to batch state: ${batch}`,
          );
          state = batch;
      }
    }

    this.logger.log(`Final state determined: ${state}`);

    return {
      id: file_id,
      state,
    };
  }

  private checkUpdateChallenge(challenge: string) {
    const INTASEND_MPESA_TX_UPDATE_CHALLENGE = 'BITSACCO';
    if (challenge !== INTASEND_MPESA_TX_UPDATE_CHALLENGE) {
      this.logger.error('Unauthorized update. Challenge is invalid');
      throw new Error('Rejected mpesa transaction update');
    }
  }
}
