import { firstValueFrom } from 'rxjs';
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
  Inject,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  CurrentUser,
  JwtAuthGuard,
  NotificationServiceClient,
  NOTIFICATION_SERVICE_NAME,
  NotificationTopic,
  UsersDocument,
} from '@bitsacco/common';
import {
  GetNotificationsResponseDto,
  MarkAsReadDto,
  MarkAsReadResponseDto,
  UpdatePreferencesDto,
  UpdatePreferencesResponseDto,
} from './dto/notification.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  private notificationService: NotificationServiceClient;
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    @Inject(NOTIFICATION_SERVICE_NAME)
    private readonly grpc: ClientGrpc,
  ) {
    this.notificationService = this.grpc.getService<NotificationServiceClient>(
      NOTIFICATION_SERVICE_NAME,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get user notifications with filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated user notifications',
    type: GetNotificationsResponseDto,
  })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({
    name: 'topics',
    required: false,
    type: [Number],
    isArray: true,
    enum: NotificationTopic,
    description:
      'Filter by topics (0=TRANSACTION, 1=SECURITY, 2=SYSTEM, 3=SWAP, 4=SHARES, 5=CHAMA)',
  })
  async getNotifications(
    @CurrentUser() user: UsersDocument,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('topics') topics?: NotificationTopic[],
  ): Promise<GetNotificationsResponseDto> {
    try {
      const pagination = {
        page: page !== undefined ? Number(page) : 0,
        size: size !== undefined ? Number(size) : 10,
      };

      // Convert topics to array of numbers if provided
      const topicsArray = topics
        ? Array.isArray(topics)
          ? topics.map((t) => Number(t))
          : [Number(topics)]
        : [];

      const response = await firstValueFrom(
        this.notificationService.getNotifications({
          userId: user._id,
          unreadOnly: unreadOnly === 'true',
          pagination,
          topics: topicsArray,
        }),
      );

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching notifications: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to fetch notifications');
    }
  }

  @Post('read')
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as read successfully',
    type: MarkAsReadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async markAsRead(
    @CurrentUser() user: UsersDocument,
    @Body() body: MarkAsReadDto,
  ): Promise<MarkAsReadResponseDto> {
    try {
      await firstValueFrom(
        this.notificationService.markAsRead({
          userId: user._id,
          notificationIds: body.notificationIds || [],
        }),
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error marking notifications as read: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        error.message || 'Failed to mark notifications as read',
      );
    }
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Returns user notification preferences',
  })
  async getPreferences(@CurrentUser() user: UsersDocument) {
    try {
      const response = await firstValueFrom(
        this.notificationService.getPreferences({
          userId: user._id,
        }),
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Error fetching notification preferences: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to fetch notification preferences',
      );
    }
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
    type: UpdatePreferencesResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updatePreferences(
    @CurrentUser() user: UsersDocument,
    @Body() body: UpdatePreferencesDto,
  ): Promise<UpdatePreferencesResponseDto> {
    try {
      await firstValueFrom(
        this.notificationService.updatePreferences({
          userId: user._id,
          channels: body.channels || [],
          topics: body.topics || [],
        }),
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error updating notification preferences: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        error.message || 'Failed to update notification preferences',
      );
    }
  }
}
