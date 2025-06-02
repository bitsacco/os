import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../services/user.service';

@Injectable()
export class PhoneStrategy {
  constructor(private readonly userService: UserService) {}

  async validate(req: any): Promise<any> {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      throw new UnauthorizedException('Phone and OTP are required');
    }

    // Validate phone format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      throw new UnauthorizedException('Invalid phone number format');
    }

    // Validate OTP format (6 digits)
    const otpRegex = /^\d{6}$/;
    if (!otpRegex.test(otp)) {
      throw new UnauthorizedException('Invalid OTP format');
    }

    // Find user by phone
    const user = await this.userService.findByPhone(phone);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // In development, accept any 6-digit OTP
    // In production, this would verify against stored OTP
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test'
    ) {
      return { userId: user._id, user, type: 'phone' };
    }

    // TODO: Implement actual OTP verification
    throw new UnauthorizedException('OTP verification not implemented');
  }
}
