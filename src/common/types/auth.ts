import {
  User,
  RefreshTokenRequest,
  RevokeTokenRequest,
  RevokeTokenResponse,
  TokensResponse,
} from './proto/auth';

export interface AuthTokenPayload {
  user: User;
  iat: number;
  nbf: number;
  iss: string;
  aud: string;
  jti: string;
  exp?: number; // Optional as it will be added by JWT service
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  iat: number;
  jti: string;
  iss: string;
  sub: string;
  exp?: number; // Optional as it will be added by JWT service
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
