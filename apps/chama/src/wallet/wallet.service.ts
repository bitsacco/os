import {
  ChamaContinueDepositDto,
  ChamaContinueWithdrawDto,
  ChamaDepositDto,
  ChamaWithdrawDto,
  FilterChamaTransactionsDto,
  FindTxRequestDto,
  UpdateChamaTransactionDto,
} from '@bitsacco/common';
import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class ChamaWalletService {
  deposit(request: ChamaDepositDto) {
    throw new NotImplementedException('deposit method not implemented');
  }

  continueDeposit(request: ChamaContinueDepositDto) {
    throw new NotImplementedException('continueDeposit method not implemented');
  }

  withdrawFunds(request: ChamaWithdrawDto) {
    throw new NotImplementedException('withdrawFunds method not implemented');
  }

  continueWithdraw(request: ChamaContinueWithdrawDto) {
    throw new NotImplementedException(
      'continueWithdraw method not implemented',
    );
  }

  updateTransaction(request: UpdateChamaTransactionDto) {
    throw new NotImplementedException(
      'updateTransaction method not implemented',
    );
  }

  findTransaction(request: FindTxRequestDto) {
    throw new NotImplementedException('findTransaction method not implemented');
  }

  filterTransactions(request: FilterChamaTransactionsDto) {
    throw new NotImplementedException(
      'filterTransactions method not implemented',
    );
  }
}
