import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class PhoneStategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({ usernameField: 'phone', passwordField: 'pinHash' });
  }

  async validate(phone: string, pin: string) {
    try {
      return await this.usersService.validateUser({
        pin,
        phone,
      });
    } catch (err) {
      throw new UnauthorizedException(err);
    }
  }
}
