import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  UpdateUserRequestDto,
  UsersService,
  ResourceOwnerGuard,
  CheckOwnership,
} from '@bitsacco/common';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {
    this.logger.debug('UsersController initialized');
  }

  @Get('all')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List all users' })
  async listUsers() {
    return this.usersService.listUsers();
  }

  @Get('/find/id/:id')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'id', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async findUserById(@Param('id') id: string) {
    return this.usersService.findUser({ id });
  }

  @Get('/find/phone/:phone')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get user by phone' })
  @ApiParam({ name: 'phone', description: 'User phone' })
  async findUserByPhone(@Param('phone') phone: string) {
    return this.usersService.findUser({ phone });
  }

  @Get('/find/npub/:npub')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get user by npub' })
  @ApiParam({ name: 'npub', description: 'User npub' })
  async findUserByNpub(@Param('npub') npub: string) {
    return this.usersService.findUser({ npub });
  }

  @Patch('/update')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'id', idField: 'id' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update user' })
  @ApiBody({ type: UpdateUserRequestDto })
  async updateUser(@Body() request: UpdateUserRequestDto) {
    return this.usersService.updateUser(request);
  }
}
