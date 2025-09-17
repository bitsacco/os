import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { TransactionStatus, ChamaTxStatus } from '../types';
import { SolowalletRepository } from '../../solowallet/db';
import { ChamaWalletRepository } from '../../chamawallet/db';
import { FedimintService } from '../fedimint';
import { TimeoutConfig, TimeoutConfigService } from './timeout-config.service';

@Injectable()
export class TransactionTimeoutService implements OnModuleInit {
  private readonly logger = new Logger(TransactionTimeoutService.name);

  private readonly config: TimeoutConfig;

  constructor(
    private readonly solowalletRepository: SolowalletRepository,
    private readonly chamaWalletRepository: ChamaWalletRepository,
    private readonly fedimintService: FedimintService,
    private readonly timeoutConfigService: TimeoutConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.config = this.timeoutConfigService.getConfig();
  }

  onModuleInit() {
    const callback = () => {
      this.handleStuckTransactions().catch((error) => {
        this.logger.error('Error in scheduled timeout check:', error);
      });
    };

    const interval = setInterval(
      callback,
      this.config.checkIntervalSeconds * 1000,
    );
    this.schedulerRegistry.addInterval('timeout-check', interval);
    this.logger.log(
      `Transaction timeout check scheduled every ${this.config.checkIntervalSeconds} seconds`,
    );
  }

  /**
   * Check for stuck transactions - called by the scheduled interval
   */
  async handleStuckTransactions() {
    this.logger.log('Checking for stuck transactions...');

    try {
      await Promise.all([
        this.handleStuckSolowalletTransactions(),
        this.handleStuckChamawalletTransactions(),
      ]);
    } catch (error) {
      this.logger.error('Error handling stuck transactions:', error);
    }
  }

  private async handleStuckSolowalletTransactions() {
    const now = new Date();

    // Find transactions that have timed out
    const stuckTransactions = await this.solowalletRepository.find({
      status: {
        $in: [TransactionStatus.PENDING, TransactionStatus.PROCESSING],
      },
      timeoutAt: { $lte: now },
    });

    this.logger.log(
      `Found ${stuckTransactions.length} stuck solo wallet transactions`,
    );

    for (const tx of stuckTransactions) {
      try {
        await this.handleSolowalletTimeout(tx);
      } catch (error) {
        this.logger.error(
          `Failed to handle timeout for transaction ${tx._id}:`,
          error,
        );
      }
    }
  }

  private async handleStuckChamawalletTransactions() {
    const now = new Date();

    // Find transactions that have timed out
    const stuckTransactions = await this.chamaWalletRepository.find({
      status: { $in: [ChamaTxStatus.PENDING, ChamaTxStatus.PROCESSING] },
      timeoutAt: { $lte: now },
    });

    this.logger.log(
      `Found ${stuckTransactions.length} stuck chama wallet transactions`,
    );

    for (const tx of stuckTransactions) {
      try {
        await this.handleChamawalletTimeout(tx);
      } catch (error) {
        this.logger.error(
          `Failed to handle timeout for transaction ${tx._id}:`,
          error,
        );
      }
    }
  }

  private async handleSolowalletTimeout(tx: any) {
    this.logger.log(`Handling timeout for solo wallet transaction ${tx._id}`);

    // Check actual status with Fedimint
    let actualStatus: string;
    try {
      actualStatus = await this.fedimintService.checkTransactionStatus(
        tx.paymentTracker,
      );
    } catch (error) {
      this.logger.error(
        `Failed to check status for ${tx.paymentTracker}:`,
        error,
      );
      actualStatus = 'unknown';
    }

    const currentRetryCount = tx.retryCount || 0;
    const maxRetries = tx.maxRetries || this.config.maxRetries;

    switch (actualStatus) {
      case 'completed':
        // Transaction actually completed, update status
        await this.solowalletRepository.findOneAndUpdateWithVersion(
          { _id: tx._id },
          {
            status: TransactionStatus.COMPLETE,
            stateChangedAt: new Date(),
            timeoutAt: null,
          },
          tx.__v,
        );
        this.logger.log(`Transaction ${tx._id} marked as COMPLETE`);
        break;

      case 'failed':
        // Transaction failed, update status
        await this.solowalletRepository.findOneAndUpdateWithVersion(
          { _id: tx._id },
          {
            status: TransactionStatus.FAILED,
            stateChangedAt: new Date(),
            timeoutAt: null,
          },
          tx.__v,
        );
        this.logger.log(`Transaction ${tx._id} marked as FAILED`);
        break;

      case 'pending':
      case 'processing':
        // Still in progress, check if we should retry
        if (currentRetryCount < maxRetries) {
          // Extend timeout and increment retry count
          const newTimeout = new Date();
          newTimeout.setMinutes(
            newTimeout.getMinutes() +
              (actualStatus === 'pending'
                ? this.config.pendingTimeoutMinutes
                : this.config.processingTimeoutMinutes),
          );

          await this.solowalletRepository.findOneAndUpdateWithVersion(
            { _id: tx._id },
            {
              retryCount: currentRetryCount + 1,
              timeoutAt: newTimeout,
            },
            tx.__v,
          );
          this.logger.log(
            `Extended timeout for transaction ${tx._id}, retry ${currentRetryCount + 1}/${maxRetries}`,
          );
        } else {
          // Max retries reached, mark as failed
          await this.solowalletRepository.findOneAndUpdateWithVersion(
            { _id: tx._id },
            {
              status: TransactionStatus.FAILED,
              stateChangedAt: new Date(),
              timeoutAt: null,
            },
            tx.__v,
          );
          this.logger.warn(
            `Transaction ${tx._id} marked as FAILED after ${maxRetries} retries`,
          );
        }
        break;

      default:
        // Unknown status, mark for manual review
        await this.solowalletRepository.findOneAndUpdateWithVersion(
          { _id: tx._id },
          {
            status: TransactionStatus.MANUAL_REVIEW,
            stateChangedAt: new Date(),
            timeoutAt: null,
          },
          tx.__v,
        );
        this.logger.warn(
          `Transaction ${tx._id} marked for MANUAL_REVIEW due to unknown status: ${actualStatus}`,
        );
    }
  }

  private async handleChamawalletTimeout(tx: any) {
    this.logger.log(
      `Handling timeout for chama wallet transaction ${tx._id} (${tx.type})`,
    );

    // Check if this is a withdrawal with a payment tracker that we can verify with Fedimint
    if (tx.type === 'WITHDRAWAL' && tx.paymentTracker) {
      let actualStatus: string;
      try {
        actualStatus = await this.fedimintService.checkTransactionStatus(
          tx.paymentTracker,
        );
      } catch (error) {
        this.logger.error(
          `Failed to check status for ${tx.paymentTracker}:`,
          error,
        );
        actualStatus = 'unknown';
      }

      const currentRetryCount = tx.retryCount || 0;
      const maxRetries = tx.maxRetries || this.config.maxRetries;

      switch (actualStatus) {
        case 'completed':
          // Transaction actually completed, update status
          await this.chamaWalletRepository.findOneAndUpdateWithVersion(
            { _id: tx._id },
            {
              status: ChamaTxStatus.COMPLETE,
              stateChangedAt: new Date(),
              timeoutAt: null,
            },
            tx.__v,
          );
          this.logger.log(`Chama transaction ${tx._id} marked as COMPLETE`);
          break;

        case 'failed':
          // Transaction failed, update status
          await this.chamaWalletRepository.findOneAndUpdateWithVersion(
            { _id: tx._id },
            {
              status: ChamaTxStatus.FAILED,
              stateChangedAt: new Date(),
              timeoutAt: null,
            },
            tx.__v,
          );
          this.logger.log(`Chama transaction ${tx._id} marked as FAILED`);
          break;

        case 'pending':
        case 'processing':
          // Still in progress, check if we should retry
          if (currentRetryCount < maxRetries) {
            // Extend timeout and increment retry count
            const newTimeout = new Date();
            newTimeout.setMinutes(
              newTimeout.getMinutes() +
                (actualStatus === 'pending'
                  ? this.config.pendingTimeoutMinutes
                  : this.config.processingTimeoutMinutes),
            );

            await this.chamaWalletRepository.findOneAndUpdateWithVersion(
              { _id: tx._id },
              {
                retryCount: currentRetryCount + 1,
                timeoutAt: newTimeout,
              },
              tx.__v,
            );
            this.logger.log(
              `Extended timeout for chama transaction ${tx._id}, retry ${currentRetryCount + 1}/${maxRetries}`,
            );
          } else {
            // Max retries reached, mark as failed
            await this.chamaWalletRepository.findOneAndUpdateWithVersion(
              { _id: tx._id },
              {
                status: ChamaTxStatus.FAILED,
                stateChangedAt: new Date(),
                timeoutAt: null,
              },
              tx.__v,
            );
            this.logger.warn(
              `Chama transaction ${tx._id} marked as FAILED after ${maxRetries} retries`,
            );
          }
          break;

        default:
          // Unknown status, mark for manual review
          await this.chamaWalletRepository.findOneAndUpdateWithVersion(
            { _id: tx._id },
            {
              status: ChamaTxStatus.MANUAL_REVIEW,
              stateChangedAt: new Date(),
              timeoutAt: null,
            },
            tx.__v,
          );
          this.logger.warn(
            `Chama transaction ${tx._id} marked for MANUAL_REVIEW due to unknown status: ${actualStatus}`,
          );
      }
    } else {
      // For deposits or transactions without payment tracker, use simple retry logic
      const currentRetryCount = tx.retryCount || 0;
      const maxRetries = tx.maxRetries || this.config.maxRetries;

      if (currentRetryCount < maxRetries) {
        // Extend timeout
        const newTimeout = new Date();
        newTimeout.setMinutes(
          newTimeout.getMinutes() + this.config.pendingTimeoutMinutes,
        );

        await this.chamaWalletRepository.findOneAndUpdateWithVersion(
          { _id: tx._id },
          {
            retryCount: currentRetryCount + 1,
            timeoutAt: newTimeout,
          },
          tx.__v,
        );
        this.logger.log(
          `Extended timeout for chama transaction ${tx._id}, retry ${currentRetryCount + 1}/${maxRetries}`,
        );
      } else {
        // Max retries reached, mark as failed
        await this.chamaWalletRepository.findOneAndUpdateWithVersion(
          { _id: tx._id },
          {
            status: ChamaTxStatus.FAILED,
            stateChangedAt: new Date(),
            timeoutAt: null,
          },
          tx.__v,
        );
        this.logger.warn(
          `Chama transaction ${tx._id} marked as FAILED after ${maxRetries} retries`,
        );
      }
    }
  }
}
