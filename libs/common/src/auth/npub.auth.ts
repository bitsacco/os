import { Strategy } from 'passport-local';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class NpubAuthGuard extends AuthGuard('local') {}

@Injectable()
export class NpubAuthStategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({ usernameField: 'npub', passwordField: 'pinHash' });
  }

  async validate(npub: string, pin: string) {
    try {
      return await this.usersService.validateUser({
        pin,
        npub,
      });
    } catch (err) {
      throw new UnauthorizedException(err);
    }
  }
}
