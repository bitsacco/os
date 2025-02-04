import {
  AUTH_SERVICE_NAME,
  AuthRequestDto,
  AuthServiceClient,
  LoginUserRequestDto,
  RecoverUserRequestDto,
  RegisterUserRequestDto,
  VerifyUserRequestDto,
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

  loginUser(req: LoginUserRequestDto) {
    return this.client.loginUser(req);
  }

  registerUser(req: RegisterUserRequestDto) {
    return this.client.registerUser(req);
  }

  verifyUser(req: VerifyUserRequestDto) {
    return this.client.verifyUser(req);
  }

  recoverUser(req: RecoverUserRequestDto) {
    return this.client.verifyUser(req);
  }

  authenticate(req: AuthRequestDto) {
    return this.client.authenticate(req);
  }
}
