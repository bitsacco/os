import {
  AUTH_SERVICE_NAME,
  AuthRequest,
  AuthServiceClient,
  LoginUserRequest,
  RegisterUserRequest,
  VerifyUserRequest,
} from '@bitsacco/common';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Injectable()
export class AuthService implements OnModuleInit {
  private client: AuthServiceClient;

  constructor(@Inject(AUTH_SERVICE_NAME) private readonly grpc: ClientGrpc) {}

  onModuleInit() {
    this.client = this.grpc.getService<AuthServiceClient>(AUTH_SERVICE_NAME);
  }

  loginUser(req: LoginUserRequest) {
    return this.client.loginUser(req);
  }

  registerUser(req: RegisterUserRequest) {
    return this.client.registerUser(req);
  }

  verifyUser(req: VerifyUserRequest) {
    return this.client.verifyUser(req);
  }

  authenticate(req: AuthRequest) {
    return this.client.authenticate(req);
  }
}
