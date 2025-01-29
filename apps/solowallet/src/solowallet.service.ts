import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CreateOnrampSwapDto,
  Currency,
  DepositFundsRequestDto,
  WalletMeta,
  fedimint_receive_failure,
  fedimint_receive_success,
  FedimintService,
  fiatToBtc,
  UserTxsResponse,
  UserTxsRequestDto,
  FmInvoice,
  PaginatedSolowalletTxsResponse,
  QuoteDto,
  QuoteRequestDto,
  QuoteResponse,
  ReceiveContext,
  type ReceivePaymentFailureEvent,
  type ReceivePaymentSuccessEvent,
  SWAP_SERVICE_NAME,
  SwapResponse,
  SwapServiceClient,
  TransactionStatus,
  TransactionType,
  WithdrawFundsRequestDto,
  CreateOfframpSwapDto,
  UpdateTxDto,
  ContinueTxRequestDto,
} from '@bitsacco/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SolowalletDocument, SolowalletRepository } from './db';

@Injectable()
export class SolowalletService {
  private readonly logger = new Logger(SolowalletService.name);
  private readonly swapService: SwapServiceClient;

  constructor(
    private readonly wallet: SolowalletRepository,
    private readonly fedimintService: FedimintService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(SWAP_SERVICE_NAME) private readonly swapGrpc: ClientGrpc,
  ) {
    this.logger.log('SolowalletService created');
    this.swapService =
      this.swapGrpc.getService<SwapServiceClient>(SWAP_SERVICE_NAME);

    this.eventEmitter.on(
      fedimint_receive_success,
      this.handleSuccessfulReceive.bind(this),
    );
    this.eventEmitter.on(
      fedimint_receive_failure,
      this.handleFailedReceive.bind(this),
    );
    this.logger.log('SwapService initialized');
  }

  private async getQuote({ from, to, amount }: QuoteRequestDto): Promise<{
    quote: QuoteDto | null;
    amountMsats: number;
  }> {
    return firstValueFrom(
      this.swapService
        .getQuote({
          from,
          to,
          amount,
        })
        .pipe(
          tap((quote: QuoteResponse) => {
            this.logger.log(`Quote: ${JSON.stringify(quote)}`);
          }),
          map((quote: QuoteResponse) => {
            const { amountMsats } = fiatToBtc({
              amountFiat: Number(amount),
              btcToFiatRate: Number(quote.rate),
            });

            return {
              quote: {
                id: quote.id,
                refreshIfExpired: true,
              },
              amountMsats,
            };
          }),
        )
        .pipe(
          catchError((error) => {
            this.logger.error('Error geeting quote:', error);
            return of({
              amountMsats: 0,
              quote: null,
            });
          }),
        ),
    );
  }

  private async initiateOnrampSwap(fiatDeposit: CreateOnrampSwapDto): Promise<{
    status: TransactionStatus;
    amountMsats: number;
    amountFiat: number;
    reference: string;
  }> {
    const reference = fiatDeposit.reference;
    const amountFiat = Number(fiatDeposit.amountFiat);

    return firstValueFrom(
      this.swapService
        .createOnrampSwap(fiatDeposit)
        .pipe(
          tap((swap: SwapResponse) => {
            this.logger.log(`Swap: ${JSON.stringify(swap)}`);
          }),
          map((swap: SwapResponse) => {
            const { amountMsats } = fiatToBtc({
              amountFiat,
              btcToFiatRate: Number(swap.rate),
            });

            return {
              status: swap.status,
              amountMsats,
              amountFiat,
              reference,
            };
          }),
        )
        .pipe(
          catchError((error) => {
            this.logger.error('Error in swap:', error);
            return of({
              status: TransactionStatus.FAILED,
              amountMsats: 0,
              amountFiat,
              reference,
            });
          }),
        ),
    );
  }

  private async initiateOfframpSwap(
    fiatWithdraw: CreateOfframpSwapDto,
  ): Promise<{
    status: TransactionStatus;
    amountMsats: number;
    amountFiat: number;
    invoice: string;
    reference: string;
  }> {
    const reference = fiatWithdraw.reference;
    const amountFiat = Number(fiatWithdraw.amountFiat);

    return firstValueFrom(
      this.swapService
        .createOfframpSwap(fiatWithdraw)
        .pipe(
          tap((swap: SwapResponse) => {
            this.logger.log(`Swap: ${JSON.stringify(swap)}`);
          }),
          map((swap: SwapResponse) => {
            const { amountMsats } = fiatToBtc({
              amountFiat,
              btcToFiatRate: Number(swap.rate),
            });

            return {
              status: swap.status,
              invoice: swap.lightning,
              amountMsats,
              amountFiat,
              reference,
            };
          }),
        )
        .pipe(
          catchError((error) => {
            this.logger.error('Error in swap:', error);
            throw error;
          }),
        ),
    );
  }

  private async getPaginatedUserTxLedger({
    userId,
    pagination,
  }: UserTxsRequestDto): Promise<PaginatedSolowalletTxsResponse> {
    const allTx = await this.wallet.find({ userId }, { createdAt: -1 });

    const { page, size } = pagination;
    const pages = Math.ceil(allTx.length / size);

    // select the last page if requested page exceeds total pages possible
    const selectPage = page > pages ? pages - 1 : page;

    const transactions = allTx
      .slice(selectPage * size, (selectPage + 1) * size)
      .map((tx) => {
        let lightning: FmInvoice;
        try {
          lightning = JSON.parse(tx.lightning);
        } catch (error) {
          this.logger.warn('Error parsing lightning invoice', error);
          lightning = {
            invoice: '',
            operationId: '',
          };
        }

        let status = TransactionStatus.UNRECOGNIZED;
        try {
          status = Number(tx.status) as TransactionStatus;
        } catch (error) {
          this.logger.warn('Error parsing transaction status', error);
        }

        let type = TransactionType.UNRECOGNIZED;
        try {
          type = Number(tx.type) as TransactionType;
        } catch (error) {
          this.logger.warn('Error parsing transaction type', error);
        }

        return {
          ...tx,
          status,
          type,
          lightning,
          paymentTracker: lightning.operationId,
          id: tx._id,
          createdAt: tx.createdAt.toDateString(),
          updatedAt: tx.updatedAt.toDateString(),
        };
      });

    return {
      transactions,
      page: selectPage,
      size,
      pages,
    };
  }

  private async aggregateUserTransactions(
    userId: string,
    type: TransactionType,
  ): Promise<number> {
    let transactions: number = 0;
    try {
      transactions = await this.wallet
        .aggregate([
          {
            $match: {
              userId: userId,
              status: TransactionStatus.COMPLETE.toString(),
              type: type.toString(),
            },
          },
          {
            $group: {
              _id: '$userId',
              totalMsats: { $sum: '$amountMsats' },
            },
          },
        ])
        .then((result) => {
          return result[0].totalMsats || 0;
        });
    } catch (e) {
      this.logger.error('Error aggregating transactions', e);
    }

    return transactions;
  }

  private async getWalletMeta(userId: string): Promise<WalletMeta> {
    const totalDeposits = await this.aggregateUserTransactions(
      userId,
      TransactionType.DEPOSIT,
    );
    const totalWithdrawals = await this.aggregateUserTransactions(
      userId,
      TransactionType.WITHDRAW,
    );

    return {
      totalDeposits,
      totalWithdrawals,
      currentBalance: totalDeposits - totalWithdrawals,
    };
  }

  async depositFunds({
    userId,
    amountFiat,
    reference,
    onramp,
  }: DepositFundsRequestDto): Promise<UserTxsResponse> {
    const { quote, amountMsats } = await this.getQuote({
      from: onramp?.currency || Currency.KES,
      to: Currency.BTC,
      amount: amountFiat.toString(),
    });

    const lightning = await this.fedimintService.invoice(
      amountMsats,
      reference,
    );

    const { status } = onramp
      ? await this.initiateOnrampSwap({
          quote,
          amountFiat: amountFiat.toString(),
          reference,
          source: onramp,
          target: {
            payout: lightning,
          },
        })
      : {
          status: TransactionStatus.PENDING,
        };

    this.logger.log(`Status: ${status}`);
    const deposit = await this.wallet.create({
      userId,
      amountMsats,
      amountFiat,
      lightning: JSON.stringify(lightning),
      paymentTracker: lightning.operationId,
      type: TransactionType.DEPOSIT,
      status,
      reference,
    });

    // listen for payment
    this.fedimintService.receive(
      ReceiveContext.SOLOWALLET,
      lightning.operationId,
    );

    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination: { page: 0, size: 10 },
    });

    const meta = await this.getWalletMeta(userId);

    return {
      txId: deposit._id,
      ledger,
      meta,
      userId,
    };
  }

  async userTransactions({
    userId,
    pagination,
  }: UserTxsRequestDto): Promise<UserTxsResponse> {
    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination,
    });
    const meta = await this.getWalletMeta(userId);

    return {
      userId,
      ledger,
      meta,
    };
  }

  async withdrawFunds({
    userId,
    amountFiat,
    reference,
    offramp,
    lightning,
  }: WithdrawFundsRequestDto): Promise<UserTxsResponse> {
    const { quote, amountMsats } = await this.getQuote({
      from: Currency.BTC,
      to: offramp?.currency || Currency.KES,
      amount: amountFiat.toString(),
    });

    const { currentBalance } = await this.getWalletMeta(userId);
    if (amountMsats > currentBalance) {
      throw new Error('Insufficient funds');
    }

    let withdrawal: SolowalletDocument;

    if (lightning) {
      this.logger.log(lightning);
      const inv = await this.fedimintService.decode(lightning.invoice);
      const invoiceMsats = Number(inv.amountMsats);

      if (invoiceMsats > amountMsats || invoiceMsats > currentBalance) {
        throw new Error(
          'Invoice amount exceeds withdrawal amount or available balance',
        );
      }

      const { operationId, fee } = await this.fedimintService.pay(
        lightning.invoice,
      );
      this.logger.log('paid invoice');
      this.logger.log(operationId);

      withdrawal = await this.wallet.create({
        userId,
        amountMsats: invoiceMsats + fee * 2,
        amountFiat,
        lightning: JSON.stringify(lightning),
        paymentTracker: operationId,
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.COMPLETE,
        reference,
      });
    } else if (offramp) {
      const {
        status,
        amountMsats: offrampMsats,
        invoice,
      } = await this.initiateOfframpSwap({
        quote,
        amountFiat: amountFiat.toString(),
        reference,
        target: offramp,
      });

      const { operationId, fee } = await this.fedimintService.pay(invoice);
      withdrawal = await this.wallet.create({
        userId,
        amountMsats: offrampMsats * fee * 2,
        amountFiat,
        lightning: JSON.stringify({ invoice }),
        paymentTracker: operationId,
        type: TransactionType.WITHDRAW,
        status,
        reference,
      });
    } else {
      throw new Error('No offramp or lightning withdrawal path provided');
    }

    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination: { page: 0, size: 10 },
    });
    const meta = await this.getWalletMeta(userId);

    return {
      txId: withdrawal._id,
      ledger,
      meta,
      userId,
    };
  }

  async updateTransaction({ txId, updates }: UpdateTxDto) {
    const originTx = await this.wallet.findOne({ _id: txId });
    const { status, lightning, reference } = updates;

    let { userId } = await this.wallet.findOneAndUpdate(
      { _id: txId },
      {
        status: status !== undefined ? status : originTx.status,
        lightning: lightning !== undefined ? lightning : originTx.lightning,
        reference: reference ?? originTx.reference,
      },
    );

    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination: { page: 0, size: 10 },
    });
    const meta = await this.getWalletMeta(userId);

    return {
      txId: originTx._id,
      ledger,
      meta,
      userId,
    };
  }

  async continueTransaction({
    userId,
    txId,
    amountFiat,
    onramp,
  }: ContinueTxRequestDto): Promise<UserTxsResponse> {
    const tx = await this.wallet.findOne({ _id: txId });

    if (tx.userId !== userId) {
      throw new Error('Invalid request to continue transaction');
    }

    if (
      tx.status === TransactionStatus.COMPLETE ||
      tx.status === TransactionStatus.PROCESSING
    ) {
      throw new Error('Transaction is processing or complete');
    }

    const { quote, amountMsats } = await this.getQuote({
      from: onramp?.currency || Currency.KES,
      to: Currency.BTC,
      amount: amountFiat.toString(),
    });

    const lightning = await this.fedimintService.invoice(
      amountMsats,
      tx.reference,
    );

    const { status } = onramp
      ? await this.initiateOnrampSwap({
          quote,
          amountFiat: amountFiat.toString(),
          reference: tx.reference,
          source: onramp,
          target: {
            payout: lightning,
          },
        })
      : {
          status: TransactionStatus.PENDING,
        };

    this.logger.log(`Status: ${status}`);
    const deposit = await this.wallet.findOneAndUpdate(
      {
        _id: txId,
        userId,
      },
      {
        amountMsats,
        amountFiat,
        lightning: JSON.stringify(lightning),
        paymentTracker: lightning.operationId,
        status,
      },
    );

    // listen for payment
    this.fedimintService.receive(
      ReceiveContext.SOLOWALLET,
      lightning.operationId,
    );

    const ledger = await this.getPaginatedUserTxLedger({
      userId,
      pagination: { page: 0, size: 10 },
    });

    const meta = await this.getWalletMeta(userId);

    return {
      txId: deposit._id,
      ledger,
      meta,
      userId,
    };
  }

  @OnEvent(fedimint_receive_success)
  private async handleSuccessfulReceive({
    context,
    operationId,
  }: ReceivePaymentSuccessEvent) {
    await this.wallet.findOneAndUpdate(
      { paymentTracker: operationId },
      {
        status: TransactionStatus.COMPLETE,
      },
    );

    this.logger.log(
      `Received lightning payment for ${context} : ${operationId}`,
    );
  }

  @OnEvent(fedimint_receive_failure)
  private async handleFailedReceive({
    context,
    operationId,
  }: ReceivePaymentFailureEvent) {
    this.logger.log(
      `Failed to receive lightning payment for ${context} : ${operationId}`,
    );

    await this.wallet.findOneAndUpdate(
      { paymentTracker: operationId },
      {
        state: TransactionStatus.FAILED,
      },
    );
  }
}
