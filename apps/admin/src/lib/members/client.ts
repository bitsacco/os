'use client';

import type { User } from '@/types/user';
import { Role } from '@/types/user';
import { logger } from '@/lib/default-logger';

// Helper function to check if user has specific role
export function hasRole(user: User | null, role: Role): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false;
  }
  return user.roles.includes(role);
}

// Helper function to check if user is a super admin
export function isSuperAdmin(user: User | null): boolean {
  if (!user) return false;
  return hasRole(user, Role.SuperAdmin);
}

export interface Member extends User {
  phone?: string;
  name?: string;
  npub?: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
  // We'll keep address optional but it won't be used in the form
  address?: {
    city?: string;
    state?: string;
    country?: string;
    street?: string;
  };
}

// The API might return users as an array directly or as { users: [...] }
interface MemberListResponse {
  users?: Member[];
  // If it's a direct array, we'll handle that in the code
}

// The API might return a user directly or as { user: {...} }
interface MemberResponse {
  user?: Member;
  // If it's a direct object, we'll handle that in the code
}

interface MemberParams {
  page?: number;
  limit?: number;
  search?: string;
  roleFilter?: Role | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Map our Member type to match the API's expected format
interface CreateMemberPayload {
  pin: string; // Required by the API
  phone?: string;
  npub?: string;
  profile?: {
    name?: string;
    avatarUrl?: string;
  };
  roles: Role[];
}

interface UpdateMemberPayload {
  userId: string;
  updates: {
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
      avatarUrl?: string;
    };
    roles?: Role[];
  };
}

class MembersClient {
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

    logger.debug(`Making ${options.method || 'GET'} request to: ${apiUrl}`);

    try {
      const response = await fetch(apiUrl, {
        ...options,
        headers,
        credentials: 'include', // Send cookies for cross-origin requests
      });

      if (!response.ok) {
        logger.error(
          `Request failed: ${response.status} ${response.statusText}`,
          `URL: ${apiUrl}`,
          `Method: ${options.method || 'GET'}`,
        );
      }

      return response;
    } catch (error) {
      logger.error(`Network error when fetching ${apiUrl}:`, error);
      throw error;
    }
  }

  // Format user data from API to match our Member interface
  private formatUserToMember(user: any): Member {
    console.log('Formatting user:', user);

    if (!user || typeof user !== 'object') {
      console.error('Invalid user data received:', user);
      // Return a minimal valid Member object to prevent crashes
      return {
        id: `invalid-${new Date().getTime()}`,
        name: 'Invalid User Data',
      };
    }

    // Use a more flexible approach to mapping fields
    // This allows us to handle differences in API response format
    return {
      id: user.id || user._id || `user-${new Date().getTime()}`,
      name: user.profile?.name || user.name || user.username || 'Unknown',
      avatar: user.profile?.avatarUrl || user.avatar || user.profilePicture,
      email: user.email,
      phone: user.phone?.number || user.phoneNumber || user.phone,
      npub: user.nostr?.npub || user.npub,
      roles: user.roles || [0], // Default to Member role if missing
      createdAt: user.createdAt
        ? new Date(user.createdAt)
        : user.created
          ? new Date(user.created)
          : user.createdDate
            ? new Date(user.createdDate)
            : undefined,
      updatedAt: user.updatedAt
        ? new Date(user.updatedAt)
        : user.updated
          ? new Date(user.updated)
          : user.modifiedDate
            ? new Date(user.modifiedDate)
            : undefined,
      address: {
        // Address fields might be stored in a different way in the actual API
        city: user.profile?.address?.city || user.address?.city || user.city,
        state:
          user.profile?.address?.state || user.address?.state || user.state,
        country:
          user.profile?.address?.country ||
          user.address?.country ||
          user.country,
        street:
          user.profile?.address?.street || user.address?.street || user.street,
      },
    };
  }

  // Format our Member data to API expected format for creating
  private formatMemberToCreatePayload(
    member: Partial<Member>,
  ): CreateMemberPayload {
    const payload: CreateMemberPayload = {
      // Set a default pin or use the one provided
      pin: '123456',
      roles: member.roles || [Role.Member],
    };

    if (member.phone) {
      payload.phone = member.phone;
    }

    if (member.npub) {
      payload.npub = member.npub;
    }

    if (member.name) {
      payload.profile = {
        name: member.name,
      };
    }

    return payload;
  }

  // Format our Member data to API expected format for updating
  private formatMemberToUpdatePayload(
    id: string,
    member: Partial<Member>,
  ): UpdateMemberPayload {
    const payload: UpdateMemberPayload = {
      userId: id,
      updates: {},
    };

    // Always include phone if provided (even if empty string)
    if (member.phone !== undefined) {
      payload.updates.phone = {
        number: member.phone || '',
        verified: true, // Assuming admins can set verified status
      };
    }

    // Always include npub if provided (even if empty string)
    if (member.npub !== undefined) {
      payload.updates.nostr = {
        npub: member.npub || '',
        verified: true, // Assuming admins can set verified status
      };
    }

    // Always include name if provided (even if empty string)
    if (member.name !== undefined) {
      payload.updates.profile = payload.updates.profile || {};
      payload.updates.profile.name = member.name;
    }

    // Always include roles if provided (even if empty array)
    if (member.roles !== undefined) {
      payload.updates.roles = member.roles;
    }

    console.log('Update member payload:', payload);
    return payload;
  }

  async getMembers(
    params: MemberParams = {},
  ): Promise<{ data?: { members: Member[]; total: number }; error?: string }> {
    try {
      // The real API doesn't support filtering, pagination via query params
      // So we'll fetch all users and filter manually
      const response = await this.fetchWithAuth(`/users/all`);

      if (!response.ok) {
        try {
          const error = await response.json();
          return { error: error.message || 'Failed to fetch members' };
        } catch (e) {
          return {
            error: `Failed to fetch members: ${response.status} ${response.statusText}`,
          };
        }
      }

      // Log the raw response for debugging
      const rawData = await response.json();
      console.log('Raw API response:', rawData);

      // Check if the response has the expected structure
      if (!rawData || !Array.isArray(rawData)) {
        console.log('Unexpected API response format:', rawData);
        return {
          error: 'Invalid response format from server - expected an array',
        };
      }

      // Adapt to the actual API response format - it looks like we're getting an array directly
      // instead of the expected { users: [...] } format
      const users = Array.isArray(rawData) ? rawData : [];

      // Convert API user format to our Member format
      let members = users.map((user) => this.formatUserToMember(user));
      console.log('Formatted members:', members);

      // Apply search filtering client-side (since the API doesn't support it)
      if (params.search) {
        const searchTerm = params.search.toLowerCase();
        members = members.filter(
          (member) =>
            member.name?.toLowerCase().includes(searchTerm) ||
            member.email?.toLowerCase().includes(searchTerm) ||
            member.phone?.toLowerCase().includes(searchTerm) ||
            member.npub?.toLowerCase().includes(searchTerm),
        );
      }

      // Apply role filtering client-side
      if (params.roleFilter !== undefined && params.roleFilter !== null) {
        members = members.filter(
          (member) =>
            member.roles && member.roles.includes(params.roleFilter as Role),
        );

        // Security check: If the user is filtering for SuperAdmins but isn't a SuperAdmin,
        // don't return any results (this should never happen with the UI constraints,
        // but adding a backend check as well for extra security)
        if (params.roleFilter === Role.SuperAdmin) {
          // We would need the current user here to check if they're a super admin
          // For now, we'll trust the UI constraint and let the code proceed
          logger.debug('Role filtering on SuperAdmin role requested');
        }
      }

      // Apply sorting client-side
      if (params.sortBy) {
        members.sort((a: any, b: any) => {
          let valueA = a[params.sortBy];
          let valueB = b[params.sortBy];

          // Handle nested properties like 'address.city'
          if (params.sortBy.includes('.')) {
            const parts = params.sortBy.split('.');
            valueA = parts.reduce((obj, key) => obj?.[key], a);
            valueB = parts.reduce((obj, key) => obj?.[key], b);
          }

          // Handle null/undefined values
          if (valueA === undefined || valueA === null) return 1;
          if (valueB === undefined || valueB === null) return -1;

          // Sort strings and numbers differently
          const result =
            typeof valueA === 'string'
              ? valueA.localeCompare(valueB)
              : valueA - valueB;

          return params.sortOrder === 'desc' ? -result : result;
        });
      }

      // Store total before pagination
      const total = members.length;

      // Apply pagination client-side
      if (params.page !== undefined && params.limit !== undefined) {
        const start = params.page * params.limit;
        members = members.slice(start, start + params.limit);
      }

      return {
        data: {
          members,
          total,
        },
      };
    } catch (error) {
      logger.error('Get members error:', error);
      return {
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  async getMember(id: string): Promise<{ data?: Member; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/users/find/id/${id}`);

      if (!response.ok) {
        try {
          const error = await response.json();
          return { error: error.message || 'Failed to fetch member' };
        } catch (e) {
          return {
            error: `Failed to fetch member: ${response.status} ${response.statusText}`,
          };
        }
      }

      // Log the raw response
      const rawData = await response.json();
      console.log('Raw member API response:', rawData);

      // Handle different possible response formats
      let userData;

      if (rawData && typeof rawData === 'object') {
        // If it's a { user: {...} } format
        if (rawData.user) {
          userData = rawData.user;
        }
        // If it's a direct user object
        else if (rawData.id || rawData._id) {
          userData = rawData;
        }
        // Otherwise invalid format
        else {
          logger.error('Unexpected member data format:', rawData);
          return { error: 'Invalid response format from server' };
        }
      } else {
        logger.error('Invalid member data received:', rawData);
        return { error: 'Invalid response format from server' };
      }

      return { data: this.formatUserToMember(userData) };
    } catch (error) {
      logger.error('Get member error:', error);
      return {
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  async createMember(
    member: Partial<Member>,
  ): Promise<{ data?: Member; error?: string }> {
    try {
      // Use the register endpoint to create a new user
      const payload = this.formatMemberToCreatePayload(member);

      const response = await this.fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          return { error: error.message || 'Failed to create member' };
        } catch (e) {
          return {
            error: `Failed to create member: ${response.status} ${response.statusText}`,
          };
        }
      }

      // The register endpoint returns auth data, but we need to get the user
      // Since the user isn't verified yet, we'll just return the data that was sent
      // In a real implementation, you'd verify and then fetch the user
      return {
        data: {
          ...member,
          id: new Date().getTime().toString(), // This is a placeholder ID
          roles: payload.roles,
          createdAt: new Date(),
        } as Member,
      };
    } catch (error) {
      logger.error('Create member error:', error);
      return {
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  async updateMember(
    id: string,
    updates: Partial<Member>,
  ): Promise<{ data?: Member; error?: string }> {
    try {
      const payload = this.formatMemberToUpdatePayload(id, updates);

      // Check if updates object is empty (no fields to update)
      if (Object.keys(payload.updates).length === 0) {
        logger.warn(
          'No updates to send to API - payload has empty updates object',
        );
        return { error: 'No changes were made to the member.' };
      }

      logger.debug(`Making update member API call for ID ${id}:`, payload);

      const response = await this.fetchWithAuth('/users/update', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          logger.error('Update member API error:', errorData);
          return { error: errorData.message || 'Failed to update member' };
        } catch (e) {
          return {
            error: `Failed to update member: ${response.status} ${response.statusText}`,
          };
        }
      }

      // Fetch the updated user data
      return this.getMember(id);
    } catch (error) {
      logger.error('Update member error:', error);
      return {
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  async deleteMember(
    id: string,
  ): Promise<{ success?: boolean; error?: string }> {
    // The API doesn't provide a delete endpoint
    // In a real implementation, you might soft-delete by updating a status
    return {
      error: 'Delete operation not supported by the API',
    };
  }

  async bulkImport(
    members: Partial<Member>[],
  ): Promise<{ success?: boolean; error?: string }> {
    try {
      // Since there's no bulk import endpoint, we'll create users one by one
      const results = await Promise.all(
        members.map((member) => this.createMember(member)),
      );

      // Check if any requests failed
      const failedResults = results.filter((result) => result.error);

      if (failedResults.length > 0) {
        return {
          error: `Failed to import ${failedResults.length} of ${members.length} members`,
        };
      }

      return { success: true };
    } catch (error) {
      logger.error('Bulk import error:', error);
      return {
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  // Helper method to export members data to JSON string
  createExportData(members: Member[]): string {
    // Create a simplified version of members without internal fields
    const exportMembers = members.map((member) => ({
      name: member.name,
      phone: member.phone,
      email: member.email,
      npub: member.npub,
      roles: member.roles,
      address: member.address,
    }));

    return JSON.stringify(exportMembers, null, 2);
  }
}

export const membersClient = new MembersClient();
