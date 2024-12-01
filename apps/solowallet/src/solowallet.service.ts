import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CreateOnrampSwapDto,
  DepositFundsRequestDto,
  DepositFundsResponse,
  fiatToBtc,
  FindUserTxsRequestDto,
  PaginatedSolowalletTxsResponse,
  SolowalletTx,
  SWAP_SERVICE_NAME,
  SwapResponse,
  SwapServiceClient,
  TransactionStatus,
} from '@bitsacco/common';
import { SolowalletRepository } from './db';
import { type ClientGrpc } from '@nestjs/microservices';
import { catchError, firstValueFrom, map, of, tap } from 'rxjs';

@Injectable()
export class SolowalletService {
  private readonly logger = new Logger(SolowalletService.name);
  private readonly swapService: SwapServiceClient;

  constructor(
    private readonly wallet: SolowalletRepository,
    @Inject(SWAP_SERVICE_NAME) private readonly swapGrpc: ClientGrpc,
  ) {
    this.logger.log('SolowalletService created');
    this.swapService =
      this.swapGrpc.getService<SwapServiceClient>(SWAP_SERVICE_NAME);
  }

  private async initiateSwap(fiatDeposit: CreateOnrampSwapDto): Promise<{
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
            this.logger.log(`Swap: ${swap}`);
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

  private async getPaginatedUserDeposits({
    userId,
    pagination,
  }: FindUserTxsRequestDto): Promise<PaginatedSolowalletTxsResponse> {
    const allDeposits = await this.wallet.find({ userId }, { createdAt: -1 });

    const { page, size } = pagination;
    const pages = Math.ceil(allDeposits.length / size);

    // select the last page if requested page exceeds total pages possible
    const selectPage = page > pages ? pages - 1 : page;

    const deposits = allDeposits
      .slice(selectPage * size, (selectPage + 1) * size + size)
      .map((deposit) => ({
        ...deposit,
        id: deposit._id,
        createdAt: deposit.createdAt.toDateString(),
        updatedAt: deposit.updatedAt.toDateString(),
      }));

    return {
      transactions: deposits,
      page: selectPage,
      size,
      pages,
    };
  }

  async depositFunds({
    userId,
    fiatDeposit,
  }: DepositFundsRequestDto): Promise<DepositFundsResponse> {
    const { status, reference, amountMsats, amountFiat } = fiatDeposit
      ? await this.initiateSwap(fiatDeposit)
      : {
          status: TransactionStatus.PENDING,
          reference: '',
          amountMsats: 0,
          amountFiat: 0,
        };

    this.logger.log(status);
    const deposit = await this.wallet.create({
      userId,
      amountMsats,
      amountFiat,
      status,
      reference,
    });

    const deposits = await this.getPaginatedUserDeposits({
      userId,
      pagination: { page: 0, size: 10 },
    });

    return {
      txId: deposit._id,
      deposits,
    };
  }

  async findUserDeposits({
    userId,
    pagination,
  }: FindUserTxsRequestDto): Promise<PaginatedSolowalletTxsResponse> {
    return this.getPaginatedUserDeposits({ userId, pagination });
  }
}
