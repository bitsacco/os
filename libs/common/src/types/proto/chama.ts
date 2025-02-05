// Code generated by protoc-gen-ts_proto. DO NOT EDIT.
// versions:
//   protoc-gen-ts_proto  v2.2.7
//   protoc               v3.20.3
// source: chama.proto

/* eslint-disable */

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

export interface CreateChamaRequest {
  name: string;
  description?: string | undefined;
  members: ChamaMember[];
  createdBy: string;
}

export interface UpdateChamaRequest {
  chamaId: string;
  updates: ChamaUpdates | undefined;
}

export interface ChamaUpdates {
  name?: string | undefined;
  description?: string | undefined;
  members: ChamaMember[];
}

export interface FindChamaRequest {
  chamaId: string;
}

export interface FilterChamasRequest {
  createdBy?: string | undefined;
  memberId?: string | undefined;
}

export interface JoinChamaRequest {
  chamaId: string;
  memberInfo: ChamaMember | undefined;
}

export interface InvitemembersRequest {
  chamaId: string;
  newMemberInfo: ChamaMember[];
}
