// Role enum from the proto definition
export enum Role {
  Member = 0,
  Admin = 1,
  SuperAdmin = 3,
}

export interface User {
  id: string;
  name?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  npub?: string;
  roles?: Role[];

  [key: string]: unknown;
}
