import * as bcrypt from 'bcryptjs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  RegisterUserRequestDto,
  FindUserDto,
  toUser,
  User,
  UsersDocument,
  VerifyUserRequestDto,
  LoginUserRequestDto,
  generateOTP,
  SMS_SERVICE_NAME,
  SmsServiceClient,
} from '@bitsacco/common';
import { UsersRepository } from './users.repository';
import { ConfigService } from '@nestjs/config';
import { type ClientGrpc } from '@nestjs/microservices';

interface UserAuth {
  user: User;
  authorized: boolean;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly smsService: SmsServiceClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly users: UsersRepository,
    @Inject(SMS_SERVICE_NAME) private readonly smsGrpc: ClientGrpc,
  ) {
    this.logger.log('UsersService initialized');
    this.smsService =
      this.smsGrpc.getService<SmsServiceClient>(SMS_SERVICE_NAME);
  }

  async validateUser({
    pin,
    phone,
    npub,
  }: LoginUserRequestDto): Promise<UserAuth> {
    const ud: UsersDocument = await this.queryUser({ phone, npub });

    const pinIsValid = await bcrypt.compare(pin, ud.pinHash);
    if (!pinIsValid) {
      throw new Error('Credentials are not valid.');
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
  }: VerifyUserRequestDto): Promise<UserAuth> {
    let ud: UsersDocument = await this.queryUser({ phone, npub });

    if (!ud) {
      throw new Error('User not found');
    }

    if (otp) {
      if (otp !== ud.otp) {
        throw new Error('Invalid otp');
      }

      const newOtp = generateOTP();
      this.logger.log(`OTP-${newOtp}`);

      ud = await this.users.findOneAndUpdate({ _id: ud._id }, { otp: newOtp });

      return {
        user: toUser(ud),
        authorized: true,
      };
    }

    if (!otp) {
      // send user otp for verification
      if (phone) {
        try {
          this.smsService.sendSms({
            message: ud.otp,
            receiver: phone,
          });
        } catch (e) {
          this.logger.error(e);
        }
      }

      if (npub) {
        // send otp via nostr
      }

      return {
        user: toUser(ud),
        authorized: false,
      };
    }
  }

  private async queryUser({
    id,
    phone,
    npub,
  }: Queryuser): Promise<UsersDocument> {
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
