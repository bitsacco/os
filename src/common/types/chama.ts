import { PaginatedRequest } from './lib';

export enum ChamaMemberRole {
  Member = 0,
  Admin = 1,
  ExternalAdmin = 3,
  UNRECOGNIZED = -1,
}

export interface Chama {
  id: string;
  name: string;
  description?: string | undefined;
  members: ChamaMember[];
  /** User ID of member creating the chama */
  createdBy: string;
}

export interface ChamaMember {
  userId: string;
  roles: ChamaMemberRole[];
}

export interface ChamaInvite {
  phoneNumber?: string | undefined;
  nostrNpub?: string | undefined;
  roles: ChamaMemberRole[];
}

export interface CreateChamaRequest {
  name: string;
  description?: string | undefined;
  members: ChamaMember[];
  invites: ChamaInvite[];
  createdBy: string;
}

export interface UpdateChamaRequest {
  chamaId: string;
  updates: ChamaUpdates | undefined;
}

export interface ChamaUpdates {
  name?: string | undefined;
  description?: string | undefined;
  addMembers: ChamaMember[];
  updateMembers: ChamaMember[];
}

export interface FindChamaRequest {
  chamaId: string;
}

export interface FilterChamasRequest {
  createdBy?: string | undefined;
  memberId?: string | undefined;
  pagination?: PaginatedRequest | undefined;
}

export interface PaginatedFilterChamasResponse {
  chamas: Chama[];
  /** Current page offset */
  page: number;
  /** Number of items return per page */
  size: number;
  /** Number of pages given the current page size */
  pages: number;
  /** Total number of items across all pages */
  total: number;
}

export interface JoinChamaRequest {
  chamaId: string;
  memberInfo: ChamaMember | undefined;
}

export interface InviteMembersRequest {
  chamaId: string;
  invites: ChamaInvite[];
}

export interface GetMemberProfilesRequest {
  chamaId: string;
}

export interface MemberProfile {
  userId: string;
  roles: ChamaMemberRole[];
  name?: string | undefined;
  avatarUrl?: string | undefined;
  phoneNumber?: string | undefined;
  nostrNpub?: string | undefined;
}

export interface MemberProfilesResponse {
  members: MemberProfile[];
}
