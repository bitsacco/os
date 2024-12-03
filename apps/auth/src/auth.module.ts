import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from './users/users.service';
import { UsersController } from './users/users.controller';

@Module({
  imports: [],
  controllers: [AuthController, UsersController],
  providers: [AuthService, UsersService],
})
export class AuthModule {}
