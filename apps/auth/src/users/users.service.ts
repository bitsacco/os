import * as bcrypt from 'bcryptjs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  RegisterUserRequestDto,
  FindUserDto,
  toUser,
  User,
  UsersDocument,
  VerifyUserRequestDto,
  LoginUserRequestDto,
} from '@bitsacco/common';
import { UsersRepository } from './users.repository';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  constructor(
    private readonly configService: ConfigService,
    private readonly users: UsersRepository,
  ) {}

  async validateUser({ pin, phone, npub }: LoginUserRequestDto): Promise<User> {
    const ud: UsersDocument = await this.queryUser({ phone, npub });

    const pinHash = await bcrypt.hash(
      pin,
      this.configService.getOrThrow('PIN_SALT'),
    );
    const pinIsValid = await bcrypt.compare(pinHash, ud.pinHash);
    if (!pinIsValid) {
      throw new UnauthorizedException('Credentials are not valid.');
    }

    return toUser(ud);
  }

  async registerUser({ pin, phone, npub, roles }: RegisterUserRequestDto) {
    const user = await this.users.create({
      pinHash: await bcrypt.hash(
        pin,
        this.configService.getOrThrow('PIN_SALT'),
      ),
      phone: {
        number: phone,
        verified: false,
      },
      nostr: {
        npub,
        verified: false,
      },
      profile: undefined,
      roles,
    });

    this.verifyUser({ phone, npub });

    return toUser(user);
  }

  async findUser(req: FindUserDto) {
    const ud: UsersDocument = await this.queryUser(req);
    return toUser(ud);
  }

  async verifyUser({ otp, phone, npub }: VerifyUserRequestDto) {
    let ud: UsersDocument = await this.queryUser({ phone, npub });

    if (!ud) {
      throw new Error('User not found');
    }

    if (!otp) {
      // generate new otp and update user document
    }

    // send otp notifications to sms/nostr

    return toUser(ud);
  }

  private async queryUser({ id, phone, npub }: Queryuser) {
    let ud: UsersDocument;

    if (id) {
      ud = await this.users.findOne({ _id: id });
    } else if (phone) {
      ud = await this.users.findOne({
        $match: {
          phone: {
            $match: {
              number: phone,
            },
          },
        },
      });
    } else if (npub) {
      ud = await this.users.findOne({
        $match: {
          nostr: {
            $match: {
              npub,
            },
          },
        },
      });
    } else {
      throw new Error('Invalid user query');
    }

    if (!ud) {
      throw new Error('User not found');
    }

    return ud;
  }
}

interface Queryuser {
  id?: string;
  phone?: string;
  npub?: string;
}
