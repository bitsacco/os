// Code generated by protoc-gen-ts_proto. DO NOT EDIT.
// versions:
//   protoc-gen-ts_proto  v2.2.4
//   protoc               v3.21.12
// source: swap.proto

/* eslint-disable */
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';

export const protobufPackage = 'swap';

/** Currency: Enum representing supported currencies. */
export enum Currency {
  BTC = 0,
  KES = 1,
  UNRECOGNIZED = -1,
}

/** SwapStatus: Enum representing the possible statuses of a swap. */
export enum SwapStatus {
  PENDING = 0,
  PROCESSING = 1,
  FAILED = 2,
  COMPLETE = 3,
  UNRECOGNIZED = -1,
}

/** Empty: Represents an empty message. */
export interface Empty {}

/** QuoteRequest: Represents a request for a currency swap quote. */
export interface QuoteRequest {
  /** Currency to swap from */
  from: Currency;
  /** Currency to swap to */
  to: Currency;
  /**
   * Optional amount to quote for
   * If provided, the service will return a quote for the specified amount
   */
  amount?: string | undefined;
}

/** QuoteResponse: Represents the response for a currency swap quote. */
export interface QuoteResponse {
  /** Unique identifier for the quote */
  id: string;
  /** Currency being swapped from */
  from: Currency;
  /** Currency being swapped to */
  to: Currency;
  /** Exchange rate for the swap */
  rate: string;
  /** Expiry time (UNIX) for the quote */
  expiry: string;
  /**
   * Optional amount to be paid in target currency
   * Only available if amount was specified
   */
  amount?: string | undefined;
  /**
   * Optional fee for the swap
   * Only available if amount was specified
   */
  fee?: string | undefined;
}

/** Quote: Represents a currency swap quote. */
export interface Quote {
  /**
   * Optional quote ID to reference a quote.
   * If not specified, the service will create a new quote for the swap
   */
  id: string;
  /**
   * If the quote is expired, allow the service can refresh the quote
   * should it expire before swap
   */
  refreshIfExpired: boolean;
}

/** OnrampSwapRequest: Represents a request to create an onramp swap. */
export interface OnrampSwapRequest {
  /**
   * Optional reference to a quote.
   * If not specified, the service will create a new quote for the swap
   */
  quote?: Quote | undefined;
  /** Swap initiator reference to the account this transaction is associated with. */
  reference: string;
  /**
   * Amount to swap
   * Any transaction fees will be deducted from this amount
   */
  amountFiat: string;
  /** Source of the swap */
  source: OnrampSwapSource | undefined;
  /** Target of the swap */
  target: OnrampSwapTarget | undefined;
}

export interface OnrampSwapSource {
  /** Currency code for the target currency */
  currency: Currency;
  /** Target destination */
  origin: MobileMoney | undefined;
}

export interface OnrampSwapTarget {
  /** Lightning protocol payout */
  payout: Bolt11 | undefined;
}

export interface OfframpSwapRequest {
  /**
   * Optional reference to a quote.
   * If not specified, the service will create a new quote for the swap
   */
  quote?: Quote | undefined;
  /** Swap initiator reference to the account this transaction is associated with. */
  reference: string;
  /**
   * Amount to swap
   * Any transaction fees will be deducted from this amount
   */
  amountFiat: string;
  /** Target of the swap */
  target: OfframpSwapTarget | undefined;
}

export interface OfframpSwapTarget {
  /** Currency code for the target currency */
  currency: Currency;
  /** Mobile money payout destination */
  payout: MobileMoney | undefined;
}

export interface MobileMoney {
  /** Phone number for the mobile money offramp */
  phone: string;
}

export interface Bolt11 {
  /** Bolt11 lightning invoice */
  invoice: string;
}

/** FindSwapRequest: Represents a request to find a swap. */
export interface FindSwapRequest {
  /** Unique identifier for the swap */
  id: string;
}

export interface PaginatedRequest {
  /** Page offset to start from */
  page: number;
  /** Number of items to be return per page */
  size: number;
}

export interface PaginatedSwapResponse {
  /** List of onramp swaps */
  swaps: SwapResponse[];
  /** Current page offset */
  page: number;
  /** Number of items return per page */
  size: number;
  /** Number of pages given the current page size */
  pages: number;
}

export interface SwapResponse {
  /**
   * Unique identifier for the swap
   * You can use this to track the status on both sides of the swap
   */
  id: string;
  /** Exchange rate to be used for the swap */
  rate: string;
  /** lightning invoice to be paid for swap */
  lightning: string;
  /** Current status of the swap */
  status: SwapStatus;
  /** Optional reference to a user */
  userId?: string | undefined;
  retryCount: number;
  createdAt: string;
  updatedAt?: string | undefined;
}

export const SWAP_PACKAGE_NAME = 'swap';

/** SwapService: Defines the main service for handling swap operations. */

export interface SwapServiceClient {
  /** GetQuote: Retrieves a quote for a currency swap. */

  getQuote(request: QuoteRequest): Observable<QuoteResponse>;

  /** CreateOnrampSwap: Initiates an onramp swap transaction. */

  createOnrampSwap(request: OnrampSwapRequest): Observable<SwapResponse>;

  /** FindOnrampSwap: Finds and returns a single onramp swap. */

  findOnrampSwap(request: FindSwapRequest): Observable<SwapResponse>;

  /** ListOnrampSwaps: Lists all onramp swaps, with pagination. */

  listOnrampSwaps(request: PaginatedRequest): Observable<PaginatedSwapResponse>;

  /** CreateOfframpSwap: Initiates an offramp swap transaction. */

  createOfframpSwap(request: OfframpSwapRequest): Observable<SwapResponse>;

  /** FindOfframpSwap: Finds and returns a single offramp swap. */

  findOfframpSwap(request: FindSwapRequest): Observable<SwapResponse>;

  /** ListOfframpSwaps: Lists all offramp swaps, with pagination. */

  listOfframpSwaps(
    request: PaginatedRequest,
  ): Observable<PaginatedSwapResponse>;
}

/** SwapService: Defines the main service for handling swap operations. */

export interface SwapServiceController {
  /** GetQuote: Retrieves a quote for a currency swap. */

  getQuote(
    request: QuoteRequest,
  ): Promise<QuoteResponse> | Observable<QuoteResponse> | QuoteResponse;

  /** CreateOnrampSwap: Initiates an onramp swap transaction. */

  createOnrampSwap(
    request: OnrampSwapRequest,
  ): Promise<SwapResponse> | Observable<SwapResponse> | SwapResponse;

  /** FindOnrampSwap: Finds and returns a single onramp swap. */

  findOnrampSwap(
    request: FindSwapRequest,
  ): Promise<SwapResponse> | Observable<SwapResponse> | SwapResponse;

  /** ListOnrampSwaps: Lists all onramp swaps, with pagination. */

  listOnrampSwaps(
    request: PaginatedRequest,
  ):
    | Promise<PaginatedSwapResponse>
    | Observable<PaginatedSwapResponse>
    | PaginatedSwapResponse;

  /** CreateOfframpSwap: Initiates an offramp swap transaction. */

  createOfframpSwap(
    request: OfframpSwapRequest,
  ): Promise<SwapResponse> | Observable<SwapResponse> | SwapResponse;

  /** FindOfframpSwap: Finds and returns a single offramp swap. */

  findOfframpSwap(
    request: FindSwapRequest,
  ): Promise<SwapResponse> | Observable<SwapResponse> | SwapResponse;

  /** ListOfframpSwaps: Lists all offramp swaps, with pagination. */

  listOfframpSwaps(
    request: PaginatedRequest,
  ):
    | Promise<PaginatedSwapResponse>
    | Observable<PaginatedSwapResponse>
    | PaginatedSwapResponse;
}

export function SwapServiceControllerMethods() {
  return function (constructor: Function) {
    const grpcMethods: string[] = [
      'getQuote',
      'createOnrampSwap',
      'findOnrampSwap',
      'listOnrampSwaps',
      'createOfframpSwap',
      'findOfframpSwap',
      'listOfframpSwaps',
    ];
    for (const method of grpcMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(
        constructor.prototype,
        method,
      );
      GrpcMethod('SwapService', method)(
        constructor.prototype[method],
        method,
        descriptor,
      );
    }
    const grpcStreamMethods: string[] = [];
    for (const method of grpcStreamMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(
        constructor.prototype,
        method,
      );
      GrpcStreamMethod('SwapService', method)(
        constructor.prototype[method],
        method,
        descriptor,
      );
    }
  };
}

export const SWAP_SERVICE_NAME = 'SwapService';
