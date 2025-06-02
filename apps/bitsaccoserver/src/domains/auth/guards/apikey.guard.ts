import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class ApiKeyGuard extends AuthGuard('apikey') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw (
        err ||
        new (require('@nestjs/common').UnauthorizedException)('Invalid API key')
      );
    }
    return user;
  }
}
