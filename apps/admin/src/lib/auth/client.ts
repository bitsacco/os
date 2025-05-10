'use client';

import type { User, Role } from '@/types/user';

// Get API URL from environment variables with fallback
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Types based on the auth.proto definition
interface AuthResponse {
  user: ProtoUser;
  accessToken?: string;
  refreshToken?: string;
}

interface TokensResponse {
  accessToken: string;
  refreshToken: string;
}

interface ProtoUser {
  id: string;
  phone?: {
    number: string;
    verified: boolean;
  };
  nostr?: {
    npub: string;
    verified: boolean;
  };
  profile?: {
    name?: string;
    avatar_url?: string;
  };
  roles: Role[];
}

// Convert ProtoUser to our app's User type
function mapProtoUserToUser(protoUser: ProtoUser): User {
  return {
    id: protoUser.id,
    name: protoUser.profile?.name,
    avatar: protoUser.profile?.avatar_url,
    email: protoUser.profile?.name, // Keep compatibility with previous version
    phone: protoUser.phone?.number,
    npub: protoUser.nostr?.npub,
    roles: protoUser.roles,
  };
}

// Auth params
export interface SignUpParams {
  pin: string;
  phone?: string;
  npub?: string;
}

export interface SignInParams {
  pin: string;
  phone?: string;
  npub?: string;
}

export interface VerifyParams {
  phone?: string;
  npub?: string;
  otp?: string;
}

export interface RecoverParams {
  phone?: string;
  npub?: string;
}

class AuthClient {
  private commonHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  private async fetchWithAuth(path: string, options: RequestInit = {}) {
    const token = localStorage.getItem('access-token');

    const headers = {
      ...this.commonHeaders,
      ...options.headers,
    };

    if (token) {
      (headers as unknown as any)['Authorization'] = `Bearer ${token}`;
    }

    const apiUrl = `/api${path}`;

    console.log(`Making ${options.method || 'GET'} request to: ${apiUrl}`);

    try {
      const response = await fetch(apiUrl, {
        ...options,
        headers,
        credentials: 'include', // Send cookies for cross-origin requests
      });

      if (!response.ok) {
        console.error(
          `Request failed: ${response.status} ${response.statusText}`,
          `URL: ${apiUrl}`,
          `Method: ${options.method || 'GET'}`,
        );
      }

      return response;
    } catch (error) {
      console.error(`Network error when fetching ${apiUrl}:`, error);
      throw error;
    }
  }

  private storeTokens(accessToken: string, refreshToken: string) {
    // Store tokens in localStorage for persistence
    localStorage.setItem('access-token', accessToken);
    localStorage.setItem('refresh-token', refreshToken);

    console.log('Authentication tokens stored successfully');
  }

  async signUp(params: SignUpParams): Promise<{ data?: User; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          return { error: error.message || 'Failed to sign up' };
        } catch (e) {
          return {
            error: `Failed to sign up: ${response.status} ${response.statusText}`,
          };
        }
      }

      const data: AuthResponse = await response.json();

      if (data.accessToken && data.refreshToken) {
        this.storeTokens(data.accessToken, data.refreshToken);
      }

      return { data: mapProtoUserToUser(data.user) };
    } catch (error) {
      console.error('Sign up error:', error);
      return {
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  async signIn(params: SignInParams): Promise<{ data?: User; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          return { error: error.message || 'Failed to sign in' };
        } catch (e) {
          return {
            error: `Failed to sign in: ${response.status} ${response.statusText}`,
          };
        }
      }

      const data: AuthResponse = await response.json();

      console.log('DATA:', data);

      if (data.accessToken && data.refreshToken) {
        this.storeTokens(data.accessToken, data.refreshToken);
      }

      return { data: mapProtoUserToUser(data.user) };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  async verify(params: VerifyParams): Promise<{ data?: User; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/auth/verify', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          return { error: error.message || 'Failed to verify' };
        } catch (e) {
          return {
            error: `Failed to verify: ${response.status} ${response.statusText}`,
          };
        }
      }

      const data: AuthResponse = await response.json();

      console.log(data);

      if (data.accessToken && data.refreshToken) {
        this.storeTokens(data.accessToken, data.refreshToken);
      }

      return { data: mapProtoUserToUser(data.user) };
    } catch (error) {
      console.error('Verify error:', error);
      return {
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  async recover(params: RecoverParams): Promise<{ error?: string }> {
    try {
      const response = await this.fetchWithAuth('/auth/recover', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          return { error: error.message || 'Failed to recover account' };
        } catch (e) {
          return {
            error: `Failed to recover account: ${response.status} ${response.statusText}`,
          };
        }
      }

      return {};
    } catch (error) {
      console.error('Recover error:', error);
      return {
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  async refreshToken(): Promise<{ error?: string }> {
    const refreshToken = localStorage.getItem('refresh-token');

    if (!refreshToken) {
      return { error: 'No refresh token available' };
    }

    try {
      console.log('Attempting to refresh token');
      const response = await this.fetchWithAuth('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        console.error(
          'Token refresh failed:',
          response.status,
          response.statusText,
        );
        try {
          const error = await response.json();
          return { error: error.message || 'Failed to refresh token' };
        } catch (e) {
          return {
            error: `Failed to refresh token: ${response.status} ${response.statusText}`,
          };
        }
      }

      const data = await response.json();

      if (!data.accessToken || !data.refreshToken) {
        console.error('Invalid token refresh response:', data);
        return { error: 'Invalid token refresh response' };
      }

      console.log('Tokens refreshed successfully');
      this.storeTokens(data.accessToken, data.refreshToken);

      return {};
    } catch (error) {
      console.error('Refresh token error:', error);
      return {
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  async getUser(): Promise<{ data?: User | null; error?: string }> {
    const token = localStorage.getItem('access-token');

    if (!token) {
      console.log('No access token found in localStorage');
      return { data: null };
    }

    console.log('Access token found, fetching user data');

    try {
      // Use the /auth/authenticate endpoint as it's equivalent to /auth/me according to the backend
      const response = await this.fetchWithAuth('/auth/authenticate', {
        method: 'POST',
        body: JSON.stringify({}), // Empty body for POST request
      });

      if (response.status === 401) {
        console.log('Token expired, attempting to refresh');
        // Try to refresh the token
        const refreshResult = await this.refreshToken();
        if (refreshResult.error) {
          console.error('Token refresh failed:', refreshResult.error);
          // If refresh fails, clear tokens and return null
          this.signOut();
          return { data: null };
        }

        console.log('Token refreshed, retrying user fetch');
        // Retry with new token
        const retryResponse = await this.fetchWithAuth('/auth/authenticate', {
          method: 'POST',
          body: JSON.stringify({}),
        });

        if (!retryResponse.ok) {
          console.error(
            'Retry failed:',
            retryResponse.status,
            retryResponse.statusText,
          );
          return { data: null };
        }

        try {
          const retryData = await retryResponse.json();
          console.log('User data retrieved after token refresh');

          // Store new tokens if they're returned
          if (retryData.accessToken && retryData.refreshToken) {
            this.storeTokens(retryData.accessToken, retryData.refreshToken);
          }

          return { data: mapProtoUserToUser(retryData.user) };
        } catch (parseError) {
          console.error('Failed to parse user data:', parseError);
          return { data: null, error: 'Invalid user data format' };
        }
      }

      if (!response.ok) {
        console.error(
          'Failed to get user data:',
          response.status,
          response.statusText,
        );
        try {
          const errorData = await response.json();
          console.error('Error response:', errorData);
        } catch (e) {
          // Ignore parse errors on error responses
        }
        return { data: null };
      }

      try {
        const data = await response.json();
        console.log('Authentication response:', data);

        if (!data.user) {
          console.error('No user data in response');
          return { data: null };
        }

        // Store new tokens if they're returned
        if (data.accessToken && data.refreshToken) {
          this.storeTokens(data.accessToken, data.refreshToken);
        }

        console.log('User data retrieved successfully');
        return { data: mapProtoUserToUser(data.user) };
      } catch (parseError) {
        console.error('Failed to parse user data:', parseError);
        return { data: null, error: 'Invalid user data format' };
      }
    } catch (error) {
      console.error('Get user error:', error);
      return {
        data: null,
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  async signOut(): Promise<{ error?: string }> {
    const refreshToken = localStorage.getItem('refresh-token');

    if (refreshToken) {
      try {
        console.log('Revoking refresh token');
        // Use /auth/logout instead of /auth/revoke based on backend API structure
        await this.fetchWithAuth('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch (error) {
        console.error('Sign out error:', error);
      }
    }

    // Clear tokens from local storage
    localStorage.removeItem('access-token');
    localStorage.removeItem('refresh-token');

    console.log('User signed out, tokens removed');

    return {};
  }
}

export const authClient = new AuthClient();
