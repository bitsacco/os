import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  AuthRequestDto,
  AuthServiceControllerMethods,
  LoginUserRequestDto,
  RegisterUserRequestDto,
  VerifyUserRequestDto,
} from '@bitsacco/common';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
@AuthServiceControllerMethods()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod()
  loginUser(req: LoginUserRequestDto) {
    return this.authService.loginUser(req);
  }

  @GrpcMethod()
  registerUser(req: RegisterUserRequestDto) {
    return this.authService.registerUser(req);
  }

  @GrpcMethod()
  verifyUser(req: VerifyUserRequestDto) {
    return this.authService.verifyUser(req);
  }

  @GrpcMethod()
  authenticate(req: AuthRequestDto) {
    return this.authService.authenticate(req);
  }
}
