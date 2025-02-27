import { ExtractJwt, Strategy } from 'passport-jwt';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { type ClientGrpc } from '@nestjs/microservices';
import { PassportStrategy } from '@nestjs/passport';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthServiceClient,
  AUTH_SERVICE_NAME,
  Role,
  AuthTokenPayload,
} from '../types';
import { UsersService } from '../users';

@Injectable()
export class JwtAuthGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private authService: AuthServiceClient;

  constructor(
    @Inject(AUTH_SERVICE_NAME) private readonly grpc: ClientGrpc,
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    this.authService =
      this.grpc.getService<AuthServiceClient>(AUTH_SERVICE_NAME);
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const accessToken = getAccessToken(request);

    if (!accessToken) {
      this.logger.error('No access token found');
      return false;
    }

    // Check if public route (skipping auth check)
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );
    if (isPublic) {
      return true;
    }

    // Get required roles if any
    const roles = this.reflector.get<Role[]>('roles', context.getHandler());

    try {
      // Verify token locally first to avoid unnecessary gRPC calls
      const tokenPayload =
        this.jwtService.verify<AuthTokenPayload>(accessToken);

      // Check if token is expired
      if (new Date(tokenPayload.expires) < new Date()) {
        this.logger.warn('Token expired');
        return false;
      }

      // Set user in request
      request.user = tokenPayload.user;

      // Check roles if required
      if (roles && roles.length > 0) {
        const hasRole = roles.some((role) =>
          tokenPayload.user.roles?.includes(role),
        );

        if (!hasRole) {
          this.logger.error('User does not have required roles');
          return false;
        }
      }

      return true;
    } catch (_) {
      // If local verification fails, fallback to gRPC auth service validation
      return this.authService
        .authenticate({
          accessToken,
        })
        .pipe(
          tap(({ user }) => {
            request.user = user;
          }),
          map(() => true),
          catchError((err) => {
            this.logger.error(`Authentication failed: ${err.message}`);
            return of(false);
          }),
        );
    }
  }
}

// Public decorator to mark routes as public (no auth required)
export const Public = () => SetMetadata('isPublic', true);

@Injectable()
export class JwtAuthStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) =>
          request?.cookies?.Authentication ||
          request?.Authentication ||
          request?.headers?.Authentication ||
          (request?.headers?.authorization
            ? request.headers.authorization.replace('Bearer ', '')
            : null),
      ]),
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  async validate({ user }: AuthTokenPayload) {
    try {
      return await this.usersService.findUser({ id: user.id });
    } catch (_) {
      throw new UnauthorizedException('Invalid user');
    }
  }
}

export function getAccessToken(request: any) {
  if (request?.cookies) {
    return request.cookies['Authentication'];
  }

  const authHeader = request?.headers?.cookie;
  if (authHeader) {
    const cookies = authHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    return cookies['Authentication'];
  }

  return null;
}
