import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LnurlType,
  LnurlSubType,
  WithdrawOptions,
  WithdrawLink,
  LnurlWithdrawResponse,
  LnurlWithdrawCallbackResponse,
  TransactionStatus,
  LnurlTransactionDocument as LnurlTransactionInterface,
} from '../../common';
import { LnurlCommonService } from './lnurl-common.service';
import { LnurlTransactionService } from './lnurl-transaction.service';
import { SolowalletService } from '../../solowallet/solowallet.service';
import { ChamaWalletService } from '../../chamawallet/wallet.service';

@Injectable()
export class LnurlWithdrawService {
  private readonly logger = new Logger(LnurlWithdrawService.name);

  constructor(
    private readonly lnurlCommonService: LnurlCommonService,
    private readonly lnurlTransactionService: LnurlTransactionService,
    private readonly solowalletService: SolowalletService,
    private readonly chamaWalletService: ChamaWalletService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new LNURL withdrawal link
   */
  async createWithdrawLink(
    userId: string,
    options: WithdrawOptions,
  ): Promise<WithdrawLink> {
    this.logger.log(`Creating withdrawal link for user ${userId}`);

    // Generate unique k1
    const k1 = this.lnurlCommonService.generateK1();

    // Calculate expiry
    const expiryMinutes = options.expiryMinutes || 60;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Determine min/max withdrawable
    const minWithdrawable =
      options.minWithdrawable || Math.min(1000, options.amountMsats);
    const maxWithdrawable = options.maxWithdrawable || options.amountMsats;

    // Get callback URL
    const callback = this.lnurlCommonService.getCallbackUrl(
      '/v1/lnurl/withdraw/callback',
    );

    // Create LNURL withdraw point data
    const withdrawData = {
      k1,
      callback,
      minWithdrawable,
      maxWithdrawable,
      defaultDescription: options.description || 'Bitsacco LNURL Withdrawal',
      expiresAt,
    };

    // Create transaction record
    const transaction = await this.lnurlTransactionService.createTransaction({
      type: LnurlType.WITHDRAW,
      subType: options.singleUse
        ? LnurlSubType.LINK_WITHDRAW
        : LnurlSubType.QR_WITHDRAW,
      userId,
      amountMsats: options.amountMsats,
      lnurlData: {
        withdraw: withdrawData,
      },
      reference: options.description || 'LNURL Withdrawal',
    });

    // Generate LNURL
    const withdrawUrl = `${callback}?k1=${k1}`;
    const lnurl = this.lnurlCommonService.encodeLnurl(withdrawUrl);

    this.logger.log(`Withdrawal link created with k1: ${k1}`);

    return {
      withdrawId: transaction._id.toString(),
      lnurl,
      k1,
      expiresAt,
      minWithdrawable,
      maxWithdrawable,
    };
  }

  /**
   * Handle LNURL-withdraw callback (first step - wallet querying)
   */
  async handleWithdrawQuery(k1: string): Promise<LnurlWithdrawResponse> {
    this.logger.log(`Handling withdrawal query for k1: ${k1}`);

    // Find the withdrawal transaction
    const transaction = await this.findPendingWithdrawal(k1);
    if (!transaction) {
      throw new NotFoundException('Withdrawal request not found or expired');
    }

    const withdrawData = transaction.lnurlData.withdraw;
    if (!withdrawData) {
      throw new BadRequestException('Invalid withdrawal data');
    }

    // Check if expired
    if (new Date() > new Date(withdrawData.expiresAt)) {
      await this.updateTransactionStatus(
        transaction._id,
        TransactionStatus.FAILED,
      );
      throw new BadRequestException('Withdrawal request expired');
    }

    return {
      callback: withdrawData.callback,
      k1: withdrawData.k1,
      minWithdrawable: withdrawData.minWithdrawable,
      maxWithdrawable: withdrawData.maxWithdrawable,
      defaultDescription: withdrawData.defaultDescription,
      tag: 'withdrawRequest',
    };
  }

  /**
   * Process LNURL-withdraw callback (second step - actual withdrawal)
   */
  async processWithdrawCallback(
    k1: string,
    pr: string,
  ): Promise<LnurlWithdrawCallbackResponse> {
    this.logger.log(`Processing withdrawal callback for k1: ${k1}`);

    const startTime = Date.now();

    try {
      // Find the withdrawal transaction
      const transaction = await this.findPendingWithdrawal(k1);
      if (!transaction) {
        return {
          status: 'ERROR',
          reason: 'Withdrawal request not found',
        };
      }

      const withdrawData = transaction.lnurlData.withdraw;
      if (!withdrawData) {
        return {
          status: 'ERROR',
          reason: 'Invalid withdrawal data',
        };
      }

      // Check if expired
      if (new Date() > new Date(withdrawData.expiresAt)) {
        await this.updateTransactionStatus(
          transaction._id,
          TransactionStatus.FAILED,
        );
        return {
          status: 'ERROR',
          reason: 'Withdrawal request expired',
        };
      }

      // Check if already claimed (for single-use links)
      if (withdrawData.claimedAt) {
        return {
          status: 'ERROR',
          reason: 'Withdrawal already claimed',
        };
      }

      // Update to processing status
      await this.updateTransactionStatus(
        transaction._id,
        TransactionStatus.PROCESSING,
      );

      // Delegate invoice payment to appropriate wallet service
      const paymentResult = await this.delegateInvoicePayment(transaction, pr);

      // Update transaction with success
      const updatedTransaction =
        await this.lnurlTransactionService.updateTransactionStatus(
          transaction._id.toString(),
          TransactionStatus.COMPLETE,
          {
            completedAt: new Date(),
            lightning: {
              invoice: pr,
              operationId: paymentResult.operationId,
            },
          },
        );

      // Update withdrawal specific data
      if (!updatedTransaction) {
        this.logger.error(
          `Failed to update transaction status for withdrawal ${transaction._id}`,
        );
        throw new InternalServerErrorException(
          'Failed to update transaction status. Transaction may be in inconsistent state.',
        );
      }

      await this.lnurlTransactionService.updateOne(
        { _id: updatedTransaction._id },
        {
          'lnurlData.withdraw.claimedAt': new Date(),
          'lnurlData.withdraw.claimingWallet': 'External wallet',
        },
      );

      // Emit success event
      this.eventEmitter.emit('lnurl.withdraw.completed', {
        transactionId: transaction._id,
        userId: transaction.userId,
        amountMsats: transaction.amountMsats,
        duration: Date.now() - startTime,
      });

      this.logger.log(
        `Withdrawal completed for transaction ${transaction._id}`,
      );

      return {
        status: 'OK',
      };
    } catch (error) {
      this.logger.error(`Failed to process withdrawal: ${error.message}`);

      // Try to update transaction status to failed
      const transaction = await this.findPendingWithdrawal(k1);
      if (transaction) {
        await this.updateTransactionStatus(
          transaction._id,
          TransactionStatus.FAILED,
        );
      }

      // Emit failure event
      this.eventEmitter.emit('lnurl.withdraw.failed', {
        k1,
        error: error.message,
        duration: Date.now() - startTime,
      });

      return {
        status: 'ERROR',
        reason: error.message || 'Failed to process withdrawal',
      };
    }
  }

  /**
   * Find a pending withdrawal by k1
   */
  private async findPendingWithdrawal(
    k1: string,
  ): Promise<LnurlTransactionInterface | null> {
    return this.lnurlTransactionService.findOne({
      type: LnurlType.WITHDRAW,
      status: {
        $in: [TransactionStatus.PENDING, TransactionStatus.PROCESSING],
      },
      'lnurlData.withdraw.k1': k1,
    });
  }

  /**
   * Update transaction status
   */
  private async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
  ): Promise<void> {
    await this.lnurlTransactionService.updateTransactionStatus(
      transactionId,
      status,
    );
  }

  /**
   * Cancel a withdrawal link
   */
  async cancelWithdrawal(withdrawId: string, userId: string): Promise<void> {
    const transaction = await this.lnurlTransactionService.findOne({
      _id: withdrawId,
      userId,
      type: LnurlType.WITHDRAW,
      status: TransactionStatus.PENDING,
    });

    if (!transaction) {
      throw new NotFoundException('Withdrawal not found or already processed');
    }

    await this.updateTransactionStatus(withdrawId, TransactionStatus.FAILED);

    this.logger.log(`Withdrawal ${withdrawId} cancelled by user ${userId}`);
  }

  /**
   * List user's withdrawals
   */
  async listWithdrawals(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{
    withdrawals: LnurlTransactionInterface[];
    total: number;
  }> {
    const { transactions: withdrawals, total } =
      await this.lnurlTransactionService.findByUser(userId, {
        type: LnurlType.WITHDRAW,
        limit,
        offset,
      });

    return { withdrawals, total };
  }

  /**
   * Get withdrawal status
   */
  async getWithdrawalStatus(
    withdrawId: string,
    userId: string,
  ): Promise<LnurlTransactionInterface> {
    const transaction = await this.lnurlTransactionService.findOne({
      _id: withdrawId,
      userId,
      type: LnurlType.WITHDRAW,
    });

    if (!transaction) {
      throw new NotFoundException('Withdrawal not found');
    }

    return transaction;
  }

  /**
   * Extract operation ID from wallet service response
   */
  private extractOperationIdFromResponse(result: any): {
    operationId: string;
    fee: number;
  } {
    // Validate that we have a valid response structure
    if (
      !result?.ledger?.transactions ||
      !Array.isArray(result.ledger.transactions)
    ) {
      throw new InternalServerErrorException(
        'Invalid response structure from wallet service',
      );
    }

    // Check if we have at least one transaction
    if (result.ledger.transactions.length === 0) {
      throw new InternalServerErrorException(
        'No transactions found in wallet service response',
      );
    }

    // Extract lightning data from the first transaction
    const firstTransaction = result.ledger.transactions[0];
    const lightningField = firstTransaction.lightning;
    const lightningData =
      typeof lightningField === 'string'
        ? JSON.parse(lightningField || '{}')
        : lightningField || {};

    return {
      operationId: lightningData.operationId || '',
      fee: 0, // Fee is handled internally by the wallet service
    };
  }

  /**
   * Delegate invoice payment to the appropriate wallet service based on transaction context
   */
  private async delegateInvoicePayment(
    transaction: LnurlTransactionInterface,
    invoice: string,
  ): Promise<{ operationId: string; fee?: number }> {
    this.logger.log(
      `Delegating invoice payment for transaction ${transaction._id}`,
    );

    // Determine which wallet service to use based on transaction data
    if (transaction.chamaId) {
      // This is a chama withdrawal - use ChamaWalletService
      this.logger.log(
        `Using ChamaWalletService for chama ${transaction.chamaId}`,
      );

      // For LNURL withdrawals, we need to find if there's an approved withdrawal
      // transaction that matches this withdrawal request
      const approvedWithdrawal =
        await this.chamaWalletService.findApprovedLnurlWithdrawal(
          transaction.lnurlData.withdraw?.k1 || '',
        );

      if (!approvedWithdrawal) {
        throw new BadRequestException(
          `No approved chama withdrawal found for LNURL request with k1: ${transaction.lnurlData.withdraw?.k1} (Transaction ID: ${transaction._id})`,
        );
      }

      // Use the chama wallet service to continue the withdrawal with the lightning invoice
      const result = await this.chamaWalletService.continueWithdraw({
        chamaId: transaction.chamaId,
        memberId: approvedWithdrawal.memberId,
        txId: approvedWithdrawal.id,
        lightning: { invoice },
        pagination: { page: 0, size: 1 },
      });

      return this.extractOperationIdFromResponse(result);
    } else {
      // This is a personal wallet withdrawal - use SolowalletService
      this.logger.log(`Using SolowalletService for user ${transaction.userId}`);

      // For solo wallet, we can directly use the withdrawal method
      // Since this is an LNURL withdrawal, we need to handle it as a lightning invoice withdrawal
      const result = await this.solowalletService.withdrawFunds({
        userId: transaction.userId,
        amountFiat: transaction.amountFiat,
        reference: transaction.reference,
        lightning: { invoice },
        pagination: { page: 0, size: 1 },
      });

      return this.extractOperationIdFromResponse(result);
    }
  }
}
