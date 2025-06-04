import { ConfigService } from '@nestjs/config';
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, GrpcMethod } from '@nestjs/microservices';
import {
  ChamaContinueDepositDto,
  ChamaContinueWithdrawDto,
  ChamasServiceControllerMethods,
  ChamaTxStatus,
  ChamaWalletServiceControllerMethods,
  ChamaWithdrawDto,
  FilterChamaTransactionsDto,
  FindTxRequestDto,
  LnUrlWithdrawResponse,
  swap_status_change,
  UpdateChamaTransactionDto,
  type LnUrlWithdrawRequest,
  type SwapStatusChangeEvent,
  type UpdateChamaRequest,
  type JoinChamaRequest,
  type InviteMembersRequest,
  type CreateChamaRequest,
  type FilterChamasRequest,
  type FindChamaRequest,
  type ChamaDepositRequest,
  type ChamaTxMetaRequest,
  type BulkChamaTxMetaRequest,
  type GetMemberProfilesRequest,
} from '@bitsacco/common';
import { ChamasService } from './chamas/chamas.service';
import { ChamaWalletService } from './wallet/wallet.service';

@Controller()
@ChamasServiceControllerMethods()
@ChamaWalletServiceControllerMethods()
export class ChamaController {
  private readonly logger = new Logger(ChamaController.name);

  constructor(
    private readonly chamasService: ChamasService,
    private readonly walletService: ChamaWalletService,
    private readonly configService: ConfigService,
  ) {}

  @GrpcMethod()
  createChama(request: CreateChamaRequest) {
    return this.chamasService.createChama(request);
  }

  @GrpcMethod()
  updateChama(request: UpdateChamaRequest) {
    return this.chamasService.updateChama(request);
  }

  @GrpcMethod()
  joinChama(request: JoinChamaRequest) {
    return this.chamasService.joinChama(request);
  }

  @GrpcMethod()
  inviteMembers(request: InviteMembersRequest) {
    return this.chamasService.inviteMembers(request);
  }

  @GrpcMethod()
  findChama(request: FindChamaRequest) {
    return this.chamasService.findChama(request);
  }

  @GrpcMethod()
  getMemberProfiles(request: GetMemberProfilesRequest) {
    return this.chamasService.getMemberProfiles(request);
  }

  @GrpcMethod()
  async filterChamas(request: FilterChamasRequest) {
    return this.chamasService.filterChamas(request);
  }

  @GrpcMethod()
  deposit(request: ChamaDepositRequest) {
    return this.walletService.deposit(request);
  }

  @GrpcMethod()
  continueDeposit(request: ChamaContinueDepositDto) {
    return this.walletService.continueDeposit(request);
  }

  @GrpcMethod()
  requestWithdraw(request: ChamaWithdrawDto) {
    return this.walletService.requestWithdraw(request);
  }

  @GrpcMethod()
  continueWithdraw(request: ChamaContinueWithdrawDto) {
    return this.walletService.continueWithdraw(request);
  }

  @GrpcMethod()
  updateTransaction(request: UpdateChamaTransactionDto) {
    return this.walletService.updateTransaction(request);
  }

  @GrpcMethod()
  findTransaction(request: FindTxRequestDto) {
    return this.walletService.findTransaction(request);
  }

  @GrpcMethod()
  filterTransactions(request: FilterChamaTransactionsDto) {
    return this.walletService.filterTransactions(request);
  }

  @GrpcMethod()
  async aggregateWalletMeta({
    chamaId,
    selectMemberIds,
    skipMemberMeta,
  }: ChamaTxMetaRequest) {
    return this.walletService.aggregateWalletMeta({
      chamaId,
      selectMemberIds,
      skipMemberMeta,
    });
  }

  @GrpcMethod()
  async aggregateBulkWalletMeta({
    chamaIds,
    selectMemberIds,
    skipMemberMeta,
  }: BulkChamaTxMetaRequest) {
    return this.walletService.aggregateBulkWalletMeta({
      chamaIds,
      selectMemberIds,
      skipMemberMeta,
    });
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
      const approvedTx =
        await this.walletService.findApprovedLnurlWithdrawal(k1);

      // 2. If no pending transaction is found, this is an error
      if (!approvedTx) {
        this.logger.warn(`No pending withdrawal found for k1: ${k1}`);
        return {
          status: 'ERROR',
          reason: 'Withdrawal request not found or expired',
        };
      }

      this.logger.log(
        `Found existing withdrawal transaction: ${approvedTx.id} in status: ${approvedTx.status}`,
      );

      // 3. If transaction is not in pending state, return error
      if (approvedTx.status !== ChamaTxStatus.APPROVED) {
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
          const expectedMsats = approvedTx.amountMsats;
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

        // Verify callback
        if (callback !== this.configService.getOrThrow('LNURL_CALLBACK')) {
          return {
            status: 'ERROR',
            reason: `LNURL withdrawal has invalid callback`,
          };
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
      const result = await this.walletService.processLnUrlWithdrawCallback(
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

  @EventPattern(swap_status_change)
  async handleSwapStatusChange(event: SwapStatusChangeEvent) {
    await this.walletService.handleSwapStatusChange(event);
  }
}
