import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  AggregateChamaTransactionsDto,
  ChamaContinueDepositDto,
  ChamaContinueWithdrawDto,
  ChamaDepositDto,
  ChamasServiceControllerMethods,
  ChamaWalletServiceControllerMethods,
  ChamaWithdrawDto,
  CreateChamaDto,
  FilterChamasDto,
  FilterChamaTransactionsDto,
  FindChamaDto,
  FindTxRequestDto,
  InviteMembersDto,
  JoinChamaDto,
  UpdateChamaDto,
  UpdateChamaTransactionDto,
} from '@bitsacco/common';
import { ChamasService } from './chamas/chamas.service';
import { ChamaWalletService } from './wallet/wallet.service';

@Controller()
@ChamasServiceControllerMethods()
@ChamaWalletServiceControllerMethods()
export class ChamaController {
  constructor(
    private readonly chamasService: ChamasService,
    private readonly walletService: ChamaWalletService,
  ) {}

  @GrpcMethod()
  createChama(request: CreateChamaDto) {
    return this.chamasService.createChama(request);
  }

  @GrpcMethod()
  updateChama(request: UpdateChamaDto) {
    return this.chamasService.updateChama(request);
  }

  @GrpcMethod()
  joinChama(request: JoinChamaDto) {
    return this.chamasService.joinChama(request);
  }

  @GrpcMethod()
  inviteMembers(request: InviteMembersDto) {
    return this.chamasService.inviteMembers(request);
  }

  @GrpcMethod()
  findChama(request: FindChamaDto) {
    return this.chamasService.findChama(request);
  }

  @GrpcMethod()
  filterChamas(request: FilterChamasDto) {
    return this.chamasService.filterChamas(request);
  }

  @GrpcMethod()
  deposit(request: ChamaDepositDto) {
    return this.walletService.deposit(request);
  }

  @GrpcMethod()
  continueDeposit(request: ChamaContinueDepositDto) {
    return this.walletService.continueDeposit(request);
  }

  @GrpcMethod()
  withdraw(request: ChamaWithdrawDto) {
    return this.walletService.withdraw(request);
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
    selectChamaId,
    selectMemberId,
    skipMemberMeta,
  }: AggregateChamaTransactionsDto) {
    const chamaIds = selectChamaId?.length
      ? selectChamaId
      : (
          await this.chamasService.filterChamas({
            pagination: {
              page: 0,
              size: 0, // flag to all chama data in a single page
            },
          })
        ).chamas.map((chama) => chama.id);

    return this.walletService.aggregateWalletMeta({
      selectChamaId: chamaIds,
      selectMemberId,
      skipMemberMeta,
    });
  }
}
