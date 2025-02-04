import * as bcrypt from 'bcryptjs';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersRepository } from './users.repository';
import { toUser, UsersDocument } from '../database';
import { generateOTP } from '../utils';
import { User } from '../types';
import {
  LoginUserRequestDto,
  RegisterUserRequestDto,
  FindUserDto,
  VerifyUserRequestDto,
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

export interface UsersService {
  validateUser(loginDto: LoginUserRequestDto): Promise<PostUserAuth>;

  registerUser(registerDto: RegisterUserRequestDto): Promise<PreUserAuth>;

  findUser(findDto: FindUserDto): Promise<User>;

  verifyUser(verifyDto: VerifyUserRequestDto): Promise<PreUserAuth>;

  listUsers(): Promise<User[]>;
}

@Injectable()
export class UsersService implements UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly users: UsersRepository,
  ) {
    this.logger.log('UsersService initialized');
  }

  async validateUser({
    pin,
    phone,
    npub,
  }: LoginUserRequestDto): Promise<PostUserAuth> {
    const ud: UsersDocument = await this.queryUser({ phone, npub });

    const pinIsValid = await bcrypt.compare(pin, ud.pinHash);
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
    let salt = await bcrypt.genSalt(
      this.configService.getOrThrow('SALT_ROUNDS'),
    );
    const pinHash = await bcrypt.hash(pin, salt);

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

  async verifyUser({
    otp,
    phone,
    npub,
  }: VerifyUserRequestDto): Promise<PreUserAuth | PostUserAuth> {
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

  async listUsers(): Promise<User[]> {
    const uds = await this.users.find({});

    return uds.map(toUser);
  }
}

export const isPreUserAuth = (
  auth: PreUserAuth | PostUserAuth,
): auth is PreUserAuth => {
  return !auth.authorized;
};
