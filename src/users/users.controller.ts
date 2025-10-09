import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  UsersService,
  ResourceOwnerGuard,
  CheckOwnership,
  CurrentUser,
  HandleServiceErrors,
  type User,
} from '../common';
import { UpdateUserDto } from '../common/dto/auth.dto';

/**
 * UsersController - REST-compliant API endpoints for user management
 *
 * This controller demonstrates the v2 REST-compliant pattern with:
 * - Resource-based URLs (e.g., /users/:userId)
 * - Proper HTTP methods (GET for retrieval, PATCH for updates)
 * - Resource IDs in URLs, not request bodies
 * - Clean separation between different user lookup patterns
 *
 * Key improvements from v1:
 * - User ID in URL path for update operations (PATCH /users/:userId)
 * - Cleaner request body structure (no nested 'updates' object)
 * - Consistent resource patterns
 */
@ApiTags('users')
@Controller({
  path: 'users',
  version: '2',
})
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiCookieAuth()
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {
    this.logger.log('UsersController initialized - REST-compliant endpoints');
  }

  /**
   * List all users
   * GET /api/v2/users
   */
  @Get()
  @ApiOperation({
    summary: 'List all users',
    description: 'Retrieve a list of all users in the system.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users retrieved successfully',
  })
  @HandleServiceErrors()
  async listUsers() {
    this.logger.log('Listing all users');
    return this.usersService.listUsers();
  }

  /**
   * Get user by ID
   * GET /api/v2/users/:userId
   */
  @Get(':userId')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve user information by their unique ID.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User retrieved successfully',
  })
  @HandleServiceErrors()
  async getUserById(@Param('userId') userId: string) {
    this.logger.log(`Getting user by ID: ${userId}`);
    return this.usersService.findUser({ id: userId });
  }

  /**
   * Update user
   * PATCH /api/v2/users/:userId
   */
  @Patch(':userId')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user information. User ID is in the URL path.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to update',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    type: UpdateUserDto,
    description: 'User updates (no need to include userId in body)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
  })
  @HandleServiceErrors()
  async updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User,
  ) {
    this.logger.log(`Updating user: ${userId}`);

    // Convert v2 DTO to v1 service format
    // In v2, the updates are directly in the body, not nested
    return this.usersService.updateUser({
      userId,
      updates: updateUserDto,
      requestingUser: currentUser,
    });
  }

  /**
   * Find user by phone number
   * GET /api/v2/users/find/phone/:phone
   *
   * Kept as a specialized search endpoint for phone-based lookup
   * Alternative could be: GET /api/v2/users?phone=:phone
   */
  @Get('find/phone/:phone')
  @ApiOperation({
    summary: 'Find user by phone',
    description: 'Search for a user by their phone number.',
  })
  @ApiParam({
    name: 'phone',
    description: 'User phone number',
    example: '+254712345678',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User found by phone',
  })
  @HandleServiceErrors()
  async findUserByPhone(@Param('phone') phone: string) {
    this.logger.log(`Finding user by phone: ${phone}`);
    return this.usersService.findUser({ phone });
  }

  /**
   * Find user by Nostr npub
   * GET /api/v2/users/find/npub/:npub
   *
   * Kept as a specialized search endpoint for Nostr-based lookup
   * Alternative could be: GET /api/v2/users?npub=:npub
   */
  @Get('find/npub/:npub')
  @ApiOperation({
    summary: 'Find user by Nostr npub',
    description: 'Search for a user by their Nostr public key (npub).',
  })
  @ApiParam({
    name: 'npub',
    description: 'User Nostr npub',
    example: 'npub1...',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User found by npub',
  })
  @HandleServiceErrors()
  async findUserByNpub(@Param('npub') npub: string) {
    this.logger.log(`Finding user by npub: ${npub}`);
    return this.usersService.findUser({ npub });
  }

  /**
   * Update user profile only
   * PATCH /api/v2/users/:userId/profile
   *
   * New in v2 - granular endpoint for updating just the profile
   */
  @Patch(':userId/profile')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Update user profile',
    description: 'Update only the user profile information (name, avatar).',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    description: 'Profile updates',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Alice' },
        avatarUrl: {
          type: 'string',
          example: 'https://example.com/avatar.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
  })
  @HandleServiceErrors()
  async updateUserProfile(
    @Param('userId') userId: string,
    @Body() profileUpdate: { name?: string; avatarUrl?: string },
    @CurrentUser() currentUser: User,
  ) {
    this.logger.log(`Updating user profile: ${userId}`);

    return this.usersService.updateUser({
      userId,
      updates: {
        profile: profileUpdate,
        roles: currentUser.roles, // Preserve existing roles
      },
      requestingUser: currentUser,
    });
  }

  /**
   * Update user phone
   * PATCH /api/v2/users/:userId/phone
   *
   * New in v2 - granular endpoint for updating just the phone number
   */
  @Patch(':userId/phone')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Update user phone',
    description: 'Update the user phone number.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    description: 'Phone update',
    schema: {
      type: 'object',
      required: ['number'],
      properties: {
        number: { type: 'string', example: '+254712345678' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Phone updated successfully',
  })
  @HandleServiceErrors()
  async updateUserPhone(
    @Param('userId') userId: string,
    @Body() phoneUpdate: { number: string },
    @CurrentUser() currentUser: User,
  ) {
    this.logger.log(`Updating user phone: ${userId}`);

    return this.usersService.updateUser({
      userId,
      updates: {
        phone: {
          ...phoneUpdate,
          verified: false, // Default to unverified for new phone updates
        },
        roles: currentUser.roles, // Preserve existing roles
      },
      requestingUser: currentUser,
    });
  }

  /**
   * Update user Nostr identity
   * PATCH /api/v2/users/:userId/nostr
   *
   * New in v2 - granular endpoint for updating just the Nostr npub
   */
  @Patch(':userId/nostr')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Update user Nostr identity',
    description: 'Update the user Nostr public key (npub).',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    description: 'Nostr update',
    schema: {
      type: 'object',
      required: ['npub'],
      properties: {
        npub: { type: 'string', example: 'npub1...' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Nostr identity updated successfully',
  })
  @HandleServiceErrors()
  async updateUserNostr(
    @Param('userId') userId: string,
    @Body() nostrUpdate: { npub: string },
    @CurrentUser() currentUser: User,
  ) {
    this.logger.log(`Updating user Nostr identity: ${userId}`);

    return this.usersService.updateUser({
      userId,
      updates: {
        nostr: {
          ...nostrUpdate,
          verified: false, // Default to unverified for new nostr updates
        },
        roles: currentUser.roles, // Preserve existing roles
      },
      requestingUser: currentUser,
    });
  }
}
