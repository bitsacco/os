import { PaginatedRequest } from './lib';

export enum SharesTxStatus {
  PROPOSED = 0,
  PROCESSING = 1,
  APPROVED = 2,
  COMPLETE = 3,
  FAILED = 4,
  UNRECOGNIZED = -1,
}

export interface OfferSharesRequest {
  /** Number of shares to issue */
  quantity: number;
  /** Date from which the shares will be available for subscription */
  availableFrom: string;
  /**
   * Date until which the shares will be available for subscription
   * Shares can be sold out before this availability date lapses
   */
  availableTo?: string | undefined;
}

export interface SharesOffer {
  id: string;
  /** Number of shares issued */
  quantity: number;
  /** Number of shares subscribed by members */
  subscribedQuantity: number;
  /** Date from which the shares will be available for subscription */
  availableFrom: string;
  /**
   * Date until which the shares will be available for subscription
   * Shares can be sold out before this availability date lapses
   */
  availableTo?: string | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface AllSharesOffers {
  offers: SharesOffer[];
  totalOfferQuantity: number;
  totalSubscribedQuantity: number;
}

export interface SharesTx {
  id: string;
  userId: string;
  offerId: string;
  quantity: number;
  status: SharesTxStatus;
  transfer?: SharesTxTransferMeta | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface SharesTxTransferMeta {
  fromUserId: string;
  toUserId: string;
  quantity: number;
}

export interface SubscribeSharesRequest {
  userId: string;
  offerId: string;
  quantity: number;
}

export interface TransferSharesRequest {
  fromUserId: string;
  toUserId: string;
  sharesId: string;
  quantity: number;
}

export interface UpdateSharesRequest {
  sharesId: string;
  updates: SharesTxUpdates | undefined;
}

export interface SharesTxUpdates {
  quantity?: number | undefined;
  status?: SharesTxStatus | undefined;
  transfer?: SharesTxTransferMeta | undefined;
  offerId?: string | undefined;
}

export interface UserSharesTxsRequest {
  userId: string;
  pagination: PaginatedRequest | undefined;
}

export interface UserShareTxsResponse {
  userId: string;
  shareHoldings: number;
  shares: PaginatedUserSharesTxsResponse | undefined;
  offers: AllSharesOffers | undefined;
}

export interface AllSharesTxsResponse {
  shares: PaginatedUserSharesTxsResponse | undefined;
  offers: AllSharesOffers | undefined;
}

export interface FindShareTxRequest {
  sharesId: string;
}

export interface PaginatedUserSharesTxsResponse {
  transactions: SharesTx[];
  page: number;
  size: number;
  pages: number;
}
