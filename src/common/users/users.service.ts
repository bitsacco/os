import * as argon2 from 'argon2';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { toUser, UsersDocument } from '../database';
import { generateOTP } from '../utils';
import { type User, Role } from '../types';
import {
  LoginUserRequestDto,
  RegisterUserRequestDto,
  FindUserDto,
  VerifyUserRequestDto,
  UpdateUserRequestDto,
  RecoverUserRequestDto,
} from '../dto';
import { UsersRepository } from './users.repository';
import { RoleValidationService } from '../auth/role-validation.service';

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
  validateUser(loginDto: LoginUserRequestDto): Promise<UserAuth>;

  registerUser(registerDto: RegisterUserRequestDto): Promise<PreUserAuth>;

  recoverUser(recoverDto: RecoverUserRequestDto): Promise<UserAuth>;

  findUser(findDto: FindUserDto): Promise<User>;

  verifyUser(verifyDto: VerifyUserRequestDto): Promise<UserAuth>;

  updateUser(requestDto: UpdateUserRequestDto): Promise<UserAuth>;

  listUsers(): Promise<User[]>;
}

@Injectable()
export class UsersService implements IUsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly roleValidationService: RoleValidationService,
  ) {
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
    // Ensure only Member role is allowed during registration
    if (roles.some((role) => role !== 0)) {
      // Role.Member = 0
      throw new UnauthorizedException(
        'Only Member role is allowed during registration',
      );
    }

    const pinHash = await argon2.hash(pin);

    const otp = generateOTP();
    const otpHash = await argon2.hash(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minute expiry

    // Don't log the OTP for security
    this.logger.log(
      `OTP generated for user with phone: ${phone || 'none'}, npub: ${npub || 'none'}`,
    );

    const ud = await this.users.create({
      pinHash,
      otpHash,
      otpExpiry,
      phone: phone && {
        number: phone,
        verified: false,
      },
      nostr: npub && {
        npub,
        verified: false,
      },
      profile: undefined,
      roles: [0], // Explicitly set to Role.Member only
      __v: 0,
    });

    const user = toUser(ud);

    return {
      user,
      authorized: false,
      otp,
    };
  }

  async recoverUser({
    pin,
    phone,
    npub,
    otp,
  }: RecoverUserRequestDto): Promise<UserAuth> {
    let ud: UsersDocument = await this.queryUser({ phone, npub });

    if (!ud) {
      throw new UnauthorizedException('User not found');
    }

    // If no OTP provided, generate a new one and require verification first
    if (!otp) {
      const newOtp = generateOTP();
      const otpHash = await argon2.hash(newOtp);
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minute expiry

      this.logger.log(`Recovery OTP generated for user ${ud._id}`);

      await this.users.findOneAndUpdate(
        { _id: ud._id },
        { otpHash, otpExpiry },
      );

      return {
        user: toUser(ud),
        authorized: false,
        otp: newOtp,
      };
    }

    // Verify OTP before allowing PIN recovery
    try {
      // Check if OTP has expired
      if (ud.otpExpiry < new Date()) {
        throw new UnauthorizedException('OTP has expired');
      }

      const isValidOtp = await argon2.verify(ud.otpHash, otp);
      if (!isValidOtp) {
        throw new UnauthorizedException('Invalid OTP');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // After OTP verification, update the PIN
    const pinHash = await argon2.hash(pin);

    ud = await this.users.findOneAndUpdate(
      { _id: ud._id },
      {
        pinHash,
      },
    );

    return {
      user: toUser(ud),
      authorized: true,
    };
  }

  async findUser(req: FindUserDto): Promise<User> {
    const ud: UsersDocument = await this.queryUser(req);
    return toUser(ud);
  }

  async findUsersById(ids: Set<string>): Promise<User[]> {
    if (!ids.size) return [];

    const uds = await this.users.find({
      _id: { $in: Array.from(ids) },
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
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if OTP has expired
    if (ud.otpExpiry < new Date()) {
      // Generate new OTP if expired
      const newOtp = generateOTP();
      const otpHash = await argon2.hash(newOtp);
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      this.logger.log(
        `New OTP generated for user ${ud._id} (previous expired)`,
      );

      await this.users.findOneAndUpdate(
        { _id: ud._id },
        { otpHash, otpExpiry },
      );

      return {
        user: toUser(ud),
        authorized: false,
        otp: newOtp,
      };
    }

    // If no OTP provided, just return current state with a new OTP
    if (!otp) {
      const newOtp = generateOTP();
      const otpHash = await argon2.hash(newOtp);
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      this.logger.log(`New OTP generated for user ${ud._id}`);

      await this.users.findOneAndUpdate(
        { _id: ud._id },
        { otpHash, otpExpiry },
      );

      return {
        user: toUser(ud),
        authorized: false,
        otp: newOtp,
      };
    }

    // Verify OTP using secure comparison
    try {
      const isValidOtp = await argon2.verify(ud.otpHash, otp);
      if (!isValidOtp) {
        throw new UnauthorizedException('Invalid credentials');
      }
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate new OTP for future use
    const newOtp = generateOTP();
    const newOtpHash = await argon2.hash(newOtp);
    const newOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    this.logger.log(`User ${ud._id} verified successfully`);

    ud = await this.users.findOneAndUpdate(
      { _id: ud._id },
      {
        otpHash: newOtpHash,
        otpExpiry: newOtpExpiry,
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

  async updateUser({
    userId,
    updates,
    requestingUser, // Added parameter to track who's making the update
  }: UpdateUserRequestDto & { requestingUser?: User }): Promise<UserAuth> {
    const ud: UsersDocument = await this.queryUser({ id: userId });
    if (!ud) {
      throw new NotFoundException(`User with id ${userId} not found`);
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
      // Get the current user document - requestingUser comes from JWT context
      if (!requestingUser) {
        this.logger.warn('No requesting user provided for role update');
        throw new ForbiddenException(
          'User information required for role updates',
        );
      }

      // Validate the role update using our role validation service
      const currentRoles = (ud.roles || []).map((role) =>
        typeof role === 'string' ? parseInt(role, 10) : role,
      );

      this.roleValidationService.validateRoleUpdate(
        requestingUser,
        userId,
        currentRoles as Role[],
        updates.roles,
      );

      // If validation passes, apply the role update
      hunk.roles = updates.roles;
    }

    const updatedUser = await this.users.findOneAndUpdate(
      { _id: userId },
      hunk,
    );

    if (!updatedUser) {
      throw new InternalServerErrorException('Failed to update user');
    }

    const authorized = updatedUser.phone.verified || updatedUser.nostr.verified;
    const user = toUser(updatedUser);

    if (authorized) {
      return {
        user,
        authorized,
      };
    } else {
      // Generate a new OTP for verification
      const newOtp = generateOTP();
      const otpHash = await argon2.hash(newOtp);
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      this.logger.log(`New OTP generated for user ${userId} after update`);

      await this.users.findOneAndUpdate(
        { _id: userId },
        { otpHash, otpExpiry },
      );

      return {
        user,
        authorized: false,
        otp: newOtp,
      };
    }
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
