import { Logger } from '@nestjs/common';
import { firstValueFrom, tap, map, catchError, of } from 'rxjs';
import {
  QuoteRequestDto,
  QuoteDto,
  CreateOnrampSwapDto,
  CreateOfframpSwapDto,
} from '../dto';
import {
  QuoteResponse,
  SwapResponse,
  SwapServiceClient,
  TransactionStatus,
} from '../types';
import { fiatToBtc } from './currency';

export async function getQuote(
  { from, to, amount }: QuoteRequestDto,
  swapService: SwapServiceClient,
  logger: Logger,
): Promise<{
  quote: QuoteDto | null;
  amountMsats: number;
}> {
  return firstValueFrom(
    swapService
      .getQuote({
        from,
        to,
        amount,
      })
      .pipe(
        tap((quote: QuoteResponse) => {
          logger.log(`Quote: ${JSON.stringify(quote)}`);
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
          logger.error('Error geeting quote:', error);
          return of({
            amountMsats: 0,
            quote: null,
          });
        }),
      ),
  );
}

export async function initiateOnrampSwap<S>(
  fiatDeposit: CreateOnrampSwapDto,
  swapService: SwapServiceClient,
  logger: Logger,
): Promise<{
  status: S;
  amountMsats: number;
  amountFiat: number;
  reference: string;
}> {
  const reference = fiatDeposit.reference;
  const amountFiat = Number(fiatDeposit.amountFiat);

  return firstValueFrom(
    swapService
      .createOnrampSwap(fiatDeposit)
      .pipe(
        tap((swap: SwapResponse) => {
          logger.log(`Swap: ${JSON.stringify(swap)}`);
        }),
        map((swap: SwapResponse) => {
          const { amountMsats } = fiatToBtc({
            amountFiat,
            btcToFiatRate: Number(swap.rate),
          });

          return {
            status: swap.status as S,
            amountMsats,
            amountFiat,
            reference,
          };
        }),
      )
      .pipe(
        catchError((error) => {
          logger.error('Error in swap:', error);
          return of({
            status: TransactionStatus.FAILED as S,
            amountMsats: 0,
            amountFiat,
            reference,
          });
        }),
      ),
  );
}

export async function initiateOfframpSwap<S>(
  fiatWithdraw: CreateOfframpSwapDto,
  swapService: SwapServiceClient,
  logger: Logger,
): Promise<{
  status: S;
  amountMsats: number;
  amountFiat: number;
  invoice: string;
  swapTracker: string;
}> {
  const amountFiat = Number(fiatWithdraw.amountFiat);

  return firstValueFrom(
    swapService
      .createOfframpSwap(fiatWithdraw)
      .pipe(
        tap((swap: SwapResponse) => {
          logger.log(`Swap: ${JSON.stringify(swap)}`);
        }),
        map((swap: SwapResponse) => {
          const { amountMsats } = fiatToBtc({
            amountFiat,
            btcToFiatRate: Number(swap.rate),
          });

          return {
            status: swap.status as S,
            invoice: swap.lightning,
            amountMsats,
            amountFiat,
            swapTracker: swap.id,
          };
        }),
      )
      .pipe(
        catchError((error) => {
          logger.error('Error in swap:', error);
          throw error;
        }),
      ),
  );
}
