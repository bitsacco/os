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
  LnUrlWithdrawResponse,
  TransactionStatus,
} from '@bitsacco/common';
import { SolowalletService } from './solowallet.service';
import { FedimintService } from '@bitsacco/common';

@Controller()
@SolowalletServiceControllerMethods()
export class SolowalletController {
  private readonly logger = new Logger(SolowalletController.name);

  constructor(
    private readonly solowalletService: SolowalletService,
    private readonly fedimintService: FedimintService,
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
  async processLnUrlWithdraw(request: {
    k1: string;
    pr: string;
  }): Promise<LnUrlWithdrawResponse> {
    this.logger.log(`Processing LNURL withdraw via gRPC, k1: ${request.k1}`);

    try {
      // 1. First, find any transaction that's already using this k1 value
      const pendingTx = await this.solowalletService.findPendingLnurlWithdrawal(
        request.k1,
      );

      // 2. If a pending transaction is found and it's in PENDING state, process it
      if (pendingTx) {
        this.logger.log(
          `Found existing withdrawal transaction: ${pendingTx.id} in status: ${pendingTx.status}`,
        );

        // If transaction is pending, continue with processing
        if (pendingTx.status === TransactionStatus.PENDING) {
          // Process the payment using the existing transaction
          const result =
            await this.solowalletService.processLnUrlWithdrawCallback(
              request.k1,
              request.pr,
            );

          return {
            status: result.success ? 'OK' : 'ERROR',
            reason: result.success ? undefined : result.message,
          };
        }

        // For any other status, return error
        return {
          status: 'ERROR',
          reason: `LNURL withdrawal is now invalid or expired`,
        };
      }

      // 3. No matching transaction found - this is an error
      this.logger.warn(`No pending withdrawal found for k1: ${request.k1}`);
      return {
        status: 'ERROR',
        reason: 'Withdrawal request not found or expired',
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
