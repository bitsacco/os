import { Injectable, Logger } from '@nestjs/common';
import {
  DepositFundsRequestDto,
  UserTxsResponse,
  UserTxsRequestDto,
  SolowalletTx,
  FindTxRequestDto,
  WithdrawFundsRequestDto,
  UpdateTxDto,
  ContinueDepositFundsRequestDto,
  ContinueWithdrawFundsRequestDto,
  WalletType,
} from '../common';
import { PersonalWalletService } from '../personal/services/wallet.service';
import { SolowalletMetricsService } from './solowallet.metrics';

@Injectable()
export class SolowalletService {
  private readonly logger = new Logger(SolowalletService.name);

  constructor(
    private readonly personalWalletService: PersonalWalletService,
    private readonly solowalletMetricsService: SolowalletMetricsService,
  ) {
    this.logger.log(
      'SolowalletService created - using PersonalWalletService as backend',
    );
    this.logger.log('SolowalletService initialized');
  }

  async depositFunds(req: DepositFundsRequestDto): Promise<UserTxsResponse> {
    const startTime = Date.now();
    try {
      // Delegate to PersonalWalletService
      const walletId = this.personalWalletService.getLegacyDefaultWalletId(
        req.userId,
      );
      const result = await this.personalWalletService.depositToWallet({
        ...req,
        walletId,
      });

      // Record successful deposit metrics
      this.solowalletMetricsService.recordDepositMetric({
        userId: req.userId,
        amountMsats: req.amountMsats || 0,
        amountFiat: req.amountFiat || 0,
        method: req.onramp ? 'onramp' : 'lightning',
        success: true,
        duration: Date.now() - startTime,
      });

      // Record balance metrics
      this.solowalletMetricsService.recordBalanceMetric({
        userId: req.userId,
        balanceMsats: result.meta?.currentBalance || 0,
        activity: 'deposit',
      });

      return result;
    } catch (error) {
      // Record failed deposit metrics
      this.solowalletMetricsService.recordDepositMetric({
        userId: req.userId,
        amountMsats: 0,
        amountFiat: req.amountFiat || 0,
        method: req.onramp ? 'onramp' : 'lightning',
        success: false,
        duration: Date.now() - startTime,
        errorType: error.message || 'Unknown error',
      });

      throw error;
    }
  }

  async continueDepositFunds(
    req: ContinueDepositFundsRequestDto,
  ): Promise<UserTxsResponse> {
    // Delegate to PersonalWalletService
    return await this.personalWalletService.continueDepositFunds(req);
  }

  async userTransactions(req: UserTxsRequestDto): Promise<UserTxsResponse> {
    // Delegate to PersonalWalletService
    const result = await this.personalWalletService.userTransactions(req);

    // Record balance query metric
    this.solowalletMetricsService.recordBalanceMetric({
      userId: req.userId,
      balanceMsats: result.meta?.currentBalance || 0,
      activity: 'query',
    });

    return result;
  }

  async findTransaction(req: FindTxRequestDto): Promise<SolowalletTx> {
    // Delegate to PersonalWalletService
    return await this.personalWalletService.findTransaction(req);
  }

  async withdrawFunds(req: WithdrawFundsRequestDto): Promise<UserTxsResponse> {
    // Delegate to PersonalWalletService
    const walletId = this.personalWalletService.getLegacyDefaultWalletId(
      req.userId,
    );
    return await this.personalWalletService.withdrawFromWallet({
      ...req,
      walletId,
    });
  }

  async continueWithdrawFunds(
    req: ContinueWithdrawFundsRequestDto,
  ): Promise<UserTxsResponse> {
    // Delegate to PersonalWalletService
    return await this.personalWalletService.continueWithdrawFunds(req);
  }

  async updateTransaction(req: UpdateTxDto) {
    // Delegate to PersonalWalletService
    return await this.personalWalletService.updateTransaction(req);
  }
}
