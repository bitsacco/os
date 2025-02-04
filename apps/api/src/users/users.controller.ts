import { UsersService } from '@bitsacco/common';
import { Controller, Logger } from '@nestjs/common';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {
    this.logger.debug('AuthController initialized');
  }
}
