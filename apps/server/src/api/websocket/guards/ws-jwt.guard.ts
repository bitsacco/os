import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../../domains/auth/services/user.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient();
      const data = context.switchToWs().getData();

      const token = data.token || data.authorization?.replace('Bearer ', '');

      if (!token) {
        return false;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      if (payload.type !== 'access') {
        return false;
      }

      const user = await this.userService.findById(payload.userId);
      if (!user || user.status !== 'active') {
        return false;
      }

      // Attach user to client
      client.user = { userId: user._id, user };

      return true;
    } catch (error) {
      return false;
    }
  }
}
