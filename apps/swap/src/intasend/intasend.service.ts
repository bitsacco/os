import IntaSend = require('intasend-node');
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { MpesaTractactionState, MpesaTxTracker } from './intasend.types';
import { MpesaTransactionUpdateDto, SendSTKPushDto } from '../dto';
import { PrismaService } from '../prisma.service';

const INTASEND_MPESA_TX_UPDATE_CHALLENGE = 'BITSACCO';

@Injectable()
export class IntasendService {
  private readonly logger = new Logger(IntasendService.name);
  private intasend: IntaSend;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
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

  async sendMpesaStkPush(payload: SendSTKPushDto): Promise<MpesaTxTracker> {
    this.logger.log(`Sending STK push to ${payload.phone_number}`);
    const resp = await this.intasend.collection().mpesaStkPush(payload);

    return {
      id: resp.invoice.invoice_id,
      state: MpesaTractactionState.Pending,
    };
  }

  async updateMpesaTx({
    invoice_id,
    state,
    api_ref,
    value,
    charges,
    net_amount,
    currency,
    account,
    retry_count,
    failed_reason,
    challenge,
    created_at,
    updated_at,
  }: MpesaTransactionUpdateDto): Promise<MpesaTxTracker> {
    if (challenge !== INTASEND_MPESA_TX_UPDATE_CHALLENGE) {
      this.logger.error('Unauthorized update. Challenge is invalid');
      throw new Error('Rejected mpesa transaction update');
    }

    if (failed_reason) {
      this.logger.error(`Mpesa transaction failed: ${failed_reason}`);
    }

    const update = {
      state,
      charges,
      account,
      value,
      currency,
      apiRef: api_ref,
      netAmount: net_amount,
      retryCount: retry_count,
      createdAt: created_at,
      updatedAt: updated_at,
    };

    const tx = await this.prismaService.intasendMpesaTransaction.upsert({
      where: {
        id: invoice_id,
      },
      update,
      create: {
        id: invoice_id,
        ...update,
      },
    });

    return {
      id: tx.id,
      state,
    };
  }
}
