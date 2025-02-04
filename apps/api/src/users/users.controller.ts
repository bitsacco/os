import { UsersService } from '@bitsacco/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { Controller, Get, Logger, Param } from '@nestjs/common';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {
    this.logger.debug('UsersController initialized');
  }

  @Get('all')
  @ApiOperation({ summary: 'List all users' })
  async listUsers() {
    return this.usersService.listUsers();
  }

  @Get('/find/id/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async findUserById(@Param('id') id: string) {
    return this.usersService.findUser({ id });
  }

  @Get('/find/phone/:phone')
  @ApiOperation({ summary: 'Get user by phone' })
  @ApiParam({ name: 'phone', description: 'User phone' })
  async findUserByPhone(@Param('phone') phone: string) {
    return this.usersService.findUser({ phone });
  }

  @Get('/find/npub/:npub')
  @ApiOperation({ summary: 'Get user by npub' })
  @ApiParam({ name: 'npub', description: 'User npub' })
  async findUserByNpub(@Param('npub') npub: string) {
    return this.usersService.findUser({ npub });
  }
}
