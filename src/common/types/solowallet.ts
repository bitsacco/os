import {
  Bolt11,
  FmLightning,
  OfframpSwapTarget,
  OnrampSwapSource,
  PaginatedRequest,
  TransactionStatus,
  TransactionType,
} from './lib';

export interface DepositFundsRequest {
  userId: string;
  amountFiat: number;
  reference: string;
  onramp?: OnrampSwapSource | undefined;
  pagination?: PaginatedRequest | undefined;
}

export interface ContinueDepositFundsRequest {
  userId: string;
  txId: string;
  amountFiat: number;
  onramp?: OnrampSwapSource | undefined;
  reference?: string | undefined;
  pagination?: PaginatedRequest | undefined;
}

export interface WithdrawFundsRequest {
  userId: string;
  amountFiat?: number | undefined;
  reference: string;
  offramp?: OfframpSwapTarget | undefined;
  lightning?: Bolt11 | undefined;
  lnurlRequest?: boolean | undefined;
  pagination?: PaginatedRequest | undefined;
}

export interface ContinueWithdrawFundsRequest {
  userId: string;
  txId: string;
  amountFiat?: number | undefined;
  offramp?: OfframpSwapTarget | undefined;
  lightning?: Bolt11 | undefined;
  lnurlRequest?: boolean | undefined;
  reference: string;
  pagination?: PaginatedRequest | undefined;
}

export interface UserTxsRequest {
  userId: string;
  pagination?: PaginatedRequest | undefined;
}

export interface UserTxsResponse {
  txId?: string | undefined;
  ledger: PaginatedSolowalletTxsResponse | undefined;
  meta?: WalletMeta | undefined;
  userId: string;
}

export interface SolowalletTx {
  id: string;
  userId: string;
  status: TransactionStatus;
  amountMsats: number;
  amountFiat?: number | undefined;
  lightning: FmLightning | undefined;
  type: TransactionType;
  reference: string;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface PaginatedSolowalletTxsResponse {
  /** List of onramp swaps */
  transactions: SolowalletTx[];
  /** Current page offset */
  page: number;
  /** Number of items return per page */
  size: number;
  /** Number of pages given the current page size */
  pages: number;
}

export interface WalletMeta {
  totalDeposits: number;
  totalWithdrawals: number;
  currentBalance: number;
}

export interface UpdateTxRequest {
  txId: string;
  updates: SolowalletTxUpdates | undefined;
  pagination?: PaginatedRequest | undefined;
}

export interface SolowalletTxUpdates {
  status?: TransactionStatus | undefined;
  lightning?: Bolt11 | undefined;
  reference?: string | undefined;
}
