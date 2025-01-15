import { User } from './proto/auth';

export interface AuthTokenPayload {
  user: User;
  expires: Date;
}
