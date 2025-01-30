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

export interface UserAuth {
  user: User;
  authorized: boolean;
}

@Injectable()
export class UsersService {
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
  }: LoginUserRequestDto): Promise<UserAuth> {
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
  }: RegisterUserRequestDto): Promise<User> {
    let salt = await bcrypt.genSalt(
      this.configService.getOrThrow('SALT_ROUNDS'),
    );
    const pinHash = await bcrypt.hash(pin, salt);

    const otp = generateOTP();
    this.logger.log(`OTP-${otp}`);

    const user = await this.users.create({
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

    this.verifyUser({ otp, phone, npub });

    return toUser(user);
  }

  async findUser(req: FindUserDto): Promise<User> {
    const ud: UsersDocument = await this.queryUser(req);
    return toUser(ud);
  }

  async verifyUser({
    otp,
    phone,
    npub,
  }: VerifyUserRequestDto): Promise<UserAuth & { otp: string }> {
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
      otp,
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
}
