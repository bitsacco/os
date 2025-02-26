import {
  User,
  RefreshTokenRequest,
  RevokeTokenRequest,
  RevokeTokenResponse,
  TokensResponse,
} from './proto/auth';

export interface AuthTokenPayload {
  user: User;
  expires: Date;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  expires: Date;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

// Re-export types from proto
export type {
  RefreshTokenRequest,
  RevokeTokenRequest,
  RevokeTokenResponse,
  TokensResponse,
};
