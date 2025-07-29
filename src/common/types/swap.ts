import {
  Currency,
  OfframpSwapTarget,
  OnrampSwapSource,
  OnrampSwapTarget,
  TransactionStatus,
} from './lib';

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

/** FindSwapRequest: Represents a request to find a swap. */
export interface FindSwapRequest {
  /** Unique identifier for the swap */
  id: string;
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
  status: TransactionStatus;
  /** Optional reference to a user */
  userId?: string | undefined;
  retryCount: number;
  createdAt: string;
  updatedAt?: string | undefined;
  /** Optional human-readable message about the swap status */
  message?: string | undefined;
}
