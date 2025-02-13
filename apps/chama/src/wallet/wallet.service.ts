import {
  FilterChamaTransactionsDto,
  FindTxRequestDto,
  UpdateChamaTransactionDto,
} from '@bitsacco/common';
import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class ChamaWalletService {
  deposit(request: any) {
    throw new NotImplementedException('deposit method not implemented');
  }

  continueDeposit(request: any) {
    throw new NotImplementedException('continueDeposit method not implemented');
  }

  withdrawFunds(request: any) {
    throw new NotImplementedException('withdrawFunds method not implemented');
  }

  continueWithdraw(request: any) {
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
