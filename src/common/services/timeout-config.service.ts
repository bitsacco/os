import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionStatus } from '../types';

export interface TimeoutConfig {
  pendingTimeoutMinutes: number;
  processingTimeoutMinutes: number;
  maxRetries: number;
  checkIntervalSeconds: number;
  depositTimeoutMinutes: number;
  withdrawalTimeoutMinutes: number;
  lnurlTimeoutMinutes: number;
  offrampTimeoutMinutes: number;
}

export enum TimeoutTransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  LNURL_WITHDRAWAL = 'LNURL_WITHDRAWAL',
  OFFRAMP = 'OFFRAMP',
}

/**
 * Service for calculating transaction timeout dates based on configuration
 * This is a lightweight service that can be used anywhere without circular dependencies
 */
@Injectable()
export class TimeoutConfigService {
  private readonly config: TimeoutConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      pendingTimeoutMinutes: this.configService.get<number>(
        'TX_TIMEOUT_PENDING_MINUTES',
        15,
      ),
      processingTimeoutMinutes: this.configService.get<number>(
        'TX_TIMEOUT_PROCESSING_MINUTES',
        30,
      ),
      maxRetries: this.configService.get<number>('TX_TIMEOUT_MAX_RETRIES', 3),
      checkIntervalSeconds: this.configService.get<number>(
        'TX_TIMEOUT_CHECK_INTERVAL_SECONDS',
        60,
      ),
      depositTimeoutMinutes: this.configService.get<number>(
        'TX_TIMEOUT_DEPOSIT_MINUTES',
        15,
      ),
      withdrawalTimeoutMinutes: this.configService.get<number>(
        'TX_TIMEOUT_WITHDRAWAL_MINUTES',
        30,
      ),
      lnurlTimeoutMinutes: this.configService.get<number>(
        'TX_TIMEOUT_LNURL_MINUTES',
        30,
      ),
      offrampTimeoutMinutes: this.configService.get<number>(
        'TX_TIMEOUT_OFFRAMP_MINUTES',
        15,
      ),
    };
  }

  /**
   * Set timeout for a new transaction based on status and type
   */
  public calculateTimeoutDate(
    status: TransactionStatus,
    transactionType?: TimeoutTransactionType,
  ): Date {
    const timeout = new Date();
    let minutes = 0;

    // If transaction type is provided, use specific timeout
    if (transactionType) {
      switch (transactionType) {
        case TimeoutTransactionType.DEPOSIT:
          minutes = this.config.depositTimeoutMinutes;
          break;
        case TimeoutTransactionType.WITHDRAWAL:
          minutes = this.config.withdrawalTimeoutMinutes;
          break;
        case TimeoutTransactionType.LNURL_WITHDRAWAL:
          minutes = this.config.lnurlTimeoutMinutes;
          break;
        case TimeoutTransactionType.OFFRAMP:
          minutes = this.config.offrampTimeoutMinutes;
          break;
      }
    } else {
      // Fall back to status-based timeout
      if (status === TransactionStatus.PENDING) {
        minutes = this.config.pendingTimeoutMinutes;
      } else if (status === TransactionStatus.PROCESSING) {
        minutes = this.config.processingTimeoutMinutes;
      }
    }

    if (minutes > 0) {
      timeout.setMinutes(timeout.getMinutes() + minutes);
    }

    return timeout;
  }

  public getConfig(): TimeoutConfig {
    return { ...this.config };
  }
}
