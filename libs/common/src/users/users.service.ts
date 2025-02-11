import * as argon2 from 'argon2';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { toUser, UsersDocument } from '../database';
import { generateOTP } from '../utils';
import { User } from '../types';
import {
  LoginUserRequestDto,
  RegisterUserRequestDto,
  FindUserDto,
  VerifyUserRequestDto,
  UserUpdatesDto,
} from '../dto';

export interface PreUserAuth {
  user: User;
  authorized: false;
  otp: string;
}

export interface PostUserAuth {
  user: User;
  authorized: true;
}

type UserAuth = PreUserAuth | PostUserAuth;

export interface IUsersService {
  validateUser(loginDto: LoginUserRequestDto): Promise<PostUserAuth>;

  registerUser(registerDto: RegisterUserRequestDto): Promise<PreUserAuth>;

  findUser(findDto: FindUserDto): Promise<User>;

  verifyUser(verifyDto: VerifyUserRequestDto): Promise<UserAuth>;

  updateUser(id: string, updates: UserUpdatesDto): Promise<UserAuth>;

  listUsers(): Promise<User[]>;
}

@Injectable()
export class UsersService implements IUsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly users: UsersRepository) {
    this.logger.log('UsersService initialized');
  }

  async validateUser({
    pin,
    phone,
    npub,
  }: LoginUserRequestDto): Promise<PostUserAuth> {
    const ud: UsersDocument = await this.queryUser({ phone, npub });

    const pinIsValid = await argon2.verify(ud.pinHash, pin);
    if (!pinIsValid) {
      throw new UnauthorizedException('Credentials are not valid.');
    }

    return {
      user: toUser(ud),
      authorized: true,
    };
  }

  async registerUser({
    pin,
    phone,
    npub,
    roles,
  }: RegisterUserRequestDto): Promise<PreUserAuth> {
    const pinHash = await argon2.hash(pin);

    const otp = generateOTP();
    this.logger.log(`OTP-${otp}`);

    const ud = await this.users.create({
      pinHash,
      otp,
      phone: phone && {
        number: phone,
        verified: false,
      },
      nostr: npub && {
        npub,
        verified: false,
      },
      profile: undefined,
      roles,
    });

    const user = toUser(ud);

    return {
      user,
      authorized: false,
      otp,
    };
  }

  async findUser(req: FindUserDto): Promise<User> {
    const ud: UsersDocument = await this.queryUser(req);
    return toUser(ud);
  }

  async findUsersById(ids: Set<string>): Promise<User[]> {
    if (!ids.size) return [];

    const uds = await this.users.find({
      where: {
        id: { in: [...ids] },
      },
    });

    return uds.map(toUser);
  }

  async verifyUser({
    otp,
    phone,
    npub,
  }: VerifyUserRequestDto): Promise<UserAuth> {
    let ud: UsersDocument = await this.queryUser({ phone, npub });

    if (!ud) {
      throw new UnauthorizedException('User not found');
    }

    if (!otp) {
      return {
        user: toUser(ud),
        authorized: false,
        otp: ud.otp,
      };
    }

    if (otp !== ud.otp) {
      throw new UnauthorizedException('Invalid otp');
    }

    const newOtp = generateOTP();
    this.logger.log(`OTP-${newOtp}`);

    ud = await this.users.findOneAndUpdate(
      { _id: ud._id },
      {
        otp: newOtp,
        phone: phone &&
          ud.phone && {
            ...ud.phone,
            verified: true,
          },
        nostr: npub &&
          ud.nostr && {
            ...ud.nostr,
            verified: true,
          },
      },
    );

    return {
      user: toUser(ud),
      authorized: true,
    };
  }

  async updateUser(id: string, updates: UserUpdatesDto): Promise<UserAuth> {
    let ud: UsersDocument = await this.queryUser({ id });
    if (!ud) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const hunk: Partial<User> = {};

    if (updates.phone) {
      hunk.phone = {
        ...updates.phone,
        verified: false,
      };
    }

    if (updates.nostr) {
      hunk.nostr = {
        ...updates.nostr,
        verified: false,
      };
    }

    if (updates.profile) {
      hunk.profile = {
        ...ud.profile,
        ...updates.profile,
      };
    }

    if (updates.roles) {
      hunk.roles = updates.roles;
    }

    const updatedUser = await this.users.findOneAndUpdate({ _id: id }, hunk);

    if (!updatedUser) {
      throw new InternalServerErrorException('Failed to update user');
    }

    const authorized = updatedUser.phone.verified || updatedUser.nostr.verified;
    const user = toUser(updatedUser);

    return authorized
      ? {
          user,
          authorized,
        }
      : {
          user,
          authorized,
          otp: updatedUser.otp,
        };
  }

  async listUsers(): Promise<User[]> {
    const uds = await this.users.find({});

    return uds.map(toUser);
  }

  private async queryUser({
    id,
    phone,
    npub,
  }: {
    id?: string;
    phone?: string;
    npub?: string;
  }): Promise<UsersDocument> {
    let ud: UsersDocument;

    if (id) {
      ud = await this.users.findOne({ _id: id });
    } else if (phone) {
      ud = await this.users.findOne({
        'phone.number': phone,
      });
    } else if (npub) {
      ud = await this.users.findOne({
        'nostr.npub': npub,
      });
    } else {
      throw new UnauthorizedException('Invalid user query');
    }

    if (!ud) {
      throw new UnauthorizedException('User not found');
    }

    return ud;
  }
}

export const isPreUserAuth = (auth: UserAuth): auth is PreUserAuth => {
  return !auth.authorized;
};
