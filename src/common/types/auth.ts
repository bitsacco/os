export enum Role {
  Member = 0,
  Admin = 1,
  Suspended = 2,
  SuperAdmin = 3,
  UNRECOGNIZED = -1,
}

export interface LoginUserRequest {
  pin: string;
  phone?: string | undefined;
  npub?: string | undefined;
}

export interface RegisterUserRequest {
  pin: string;
  phone?: string | undefined;
  npub?: string | undefined;
  roles: Role[];
}

export interface VerifyUserRequest {
  phone?: string | undefined;
  npub?: string | undefined;
  otp?: string | undefined;
}

export interface RecoverUserRequest {
  pin: string;
  phone?: string | undefined;
  npub?: string | undefined;
  otp?: string | undefined;
}

export interface AuthRequest {
  accessToken: string;
}

export interface AuthResponse {
  user: User | undefined;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface TokensResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RevokeTokenRequest {
  refreshToken: string;
}

export interface RevokeTokenResponse {
  success: boolean;
}

export interface User {
  id: string;
  phone?: Phone | undefined;
  nostr?: Nostr | undefined;
  profile?: Profile | undefined;
  roles: Role[];
}

export interface Phone {
  number: string;
  verified: boolean;
}

/** Users nostr identifier */
export interface Nostr {
  npub: string;
  verified: boolean;
}

export interface Profile {
  /** Users name or nym */
  name?: string | undefined;
  /** Users avatar url */
  avatarUrl?: string | undefined;
}

export interface UpdateUserRequest {
  userId: string;
  updates: UserUpdates | undefined;
}

export interface UserUpdates {
  phone?: Phone | undefined;
  nostr?: Nostr | undefined;
  profile?: Profile | undefined;
  roles: Role[];
}

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
