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

  updateTransaction(request: any) {
    throw new NotImplementedException(
      'updateTransaction method not implemented',
    );
  }

  findTransaction(request: any) {
    throw new NotImplementedException('findTransaction method not implemented');
  }

  filterTransactions(request: any) {
    throw new NotImplementedException(
      'filterTransactions method not implemented',
    );
  }
}
