import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  SolowalletServiceControllerMethods,
  DepositFundsRequestDto,
  UserTxsRequestDto,
  WithdrawFundsRequestDto,
  UpdateTxDto,
  ContinueTxRequestDto,
  FindTxRequestDto,
  type LnUrlWithdrawRequest,
  LnUrlWithdrawResponse,
  TransactionStatus,
} from '@bitsacco/common';
import { SolowalletService } from './solowallet.service';
import { ConfigService } from '@nestjs/config';

@Controller()
@SolowalletServiceControllerMethods()
export class SolowalletController {
  private readonly logger = new Logger(SolowalletController.name);

  constructor(
    private readonly solowalletService: SolowalletService,
    private readonly configService: ConfigService,
  ) {}

  @GrpcMethod()
  depositFunds(request: DepositFundsRequestDto) {
    return this.solowalletService.depositFunds(request);
  }

  @GrpcMethod()
  userTransactions(request: UserTxsRequestDto) {
    return this.solowalletService.userTransactions(request);
  }

  @GrpcMethod()
  withdrawFunds(request: WithdrawFundsRequestDto) {
    return this.solowalletService.withdrawFunds(request);
  }

  @GrpcMethod()
  updateTransaction(request: UpdateTxDto) {
    return this.solowalletService.updateTransaction(request);
  }

  @GrpcMethod()
  continueTransaction(request: ContinueTxRequestDto) {
    return this.solowalletService.continueTransaction(request);
  }

  @GrpcMethod()
  findTransaction(request: FindTxRequestDto) {
    return this.solowalletService.findTransaction(request);
  }

  @GrpcMethod()
  async processLnUrlWithdraw({
    k1,
    tag,
    callback,
    maxWithdrawable,
    minWithdrawable,
    defaultDescription,
    pr,
  }: LnUrlWithdrawRequest): Promise<LnUrlWithdrawResponse> {
    this.logger.log(
      `Processing LNURL withdraw via gRPC, k1: ${k1}, tag: ${tag}`,
    );

    if (!k1) {
      this.logger.error(`Invalid k1: ${k1}`);
      return {
        status: 'ERROR',
        reason: `Invalid k1: ${k1}`,
      };
    }

    try {
      // 1. First, find any transaction that's already using this k1 value
      const pendingTx =
        await this.solowalletService.findPendingLnurlWithdrawal(k1);

      // 2. If no pending transaction is found, this is an error
      if (!pendingTx) {
        this.logger.warn(`No pending withdrawal found for k1: ${k1}`);
        return {
          status: 'ERROR',
          reason: 'Withdrawal request not found or expired',
        };
      }

      this.logger.log(
        `Found existing withdrawal transaction: ${pendingTx.id} in status: ${pendingTx.status}`,
      );

      // 3. If transaction is not in pending state, return error
      if (pendingTx.status !== TransactionStatus.PENDING) {
        return {
          status: 'ERROR',
          reason: `LNURL withdrawal is now invalid or expired`,
        };
      }

      // 4. Handle first step of handshake (tag=withdrawRequest && !pr - wallet querying parameters)
      if (tag === 'withdrawRequest' && !pr) {
        this.logger.log('Processing first step of LNURL withdraw handshake');

        // Verify maxWithdrawable matches our expected value (if provided in request)
        if (maxWithdrawable) {
          const expectedMsats = pendingTx.amountMsats;
          if (parseInt(maxWithdrawable) > expectedMsats) {
            this.logger.error(
              `Mismatched maxWithdrawable: expected ${expectedMsats}, got ${maxWithdrawable}`,
            );
            return {
              status: 'ERROR',
              reason: 'maxWithdrawable exceeds expected amount',
            };
          }
        }

        // Return success response for first step
        return {
          tag,
          callback,
          k1,
          defaultDescription,
          minWithdrawable,
          maxWithdrawable,
        };
      }

      // 5. Handle second step of handshake (with invoice)
      if (!pr) {
        this.logger.error(`Invalid Bolt11 invoice: ${pr}`);
        return {
          status: 'ERROR',
          reason: `Invalid Bolt11 invoice: ${pr}`,
        };
      }

      // Process the payment using the existing transaction
      const result = await this.solowalletService.processLnUrlWithdrawCallback(
        k1,
        pr,
      );

      return {
        status: result.success ? 'OK' : 'ERROR',
        reason: result.success ? undefined : result.message,
      };
    } catch (error) {
      this.logger.error(
        `Error processing LNURL withdraw: ${error.message}`,
        error.stack,
      );
      return {
        status: 'ERROR',
        reason: error.message || 'Internal server error',
      };
    }
  }
}
