import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import {
  CurrentUser,
  JwtAuthGuard,
  NotificationTopic,
  UsersDocument,
  ResourceOwnerGuard,
  CheckOwnership,
  HandleServiceErrors,
} from '../common';
import {
  MarkNotificationsAsReadDto,
  NotificationUnsubscribeDto,
  UpdateNotificationPreferencesDto,
  GetNotificationsResponseDto,
  MarkAsReadResponseDto,
  NotificationSubscribeDto,
  UpdatePreferencesResponseDto,
  BatchDeleteNotificationsDto,
} from '../common/dto/notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiCookieAuth()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {
    this.logger.log(
      'NotificationController initialized - REST-compliant endpoints',
    );
  }

  /**
   * Get user notifications
   * GET /users/:userId/notifications
   */
  @Get('users/:userId/notifications')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Get user notifications',
    description:
      'Retrieve notifications for a specific user with filtering and pagination.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    type: Boolean,
    description: 'Filter for unread notifications only',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (0-based)',
  })
  @ApiQuery({
    name: 'size',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  @ApiQuery({
    name: 'topics',
    required: false,
    type: [Number],
    isArray: true,
    enum: NotificationTopic,
    description:
      'Filter by topics (0=TRANSACTION, 1=SECURITY, 2=SYSTEM, 3=SWAP, 4=SHARES, 5=CHAMA)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated user notifications',
    type: GetNotificationsResponseDto,
  })
  @HandleServiceErrors()
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('topics') topics?: NotificationTopic[],
  ): Promise<GetNotificationsResponseDto> {
    this.logger.log(`Getting notifications for user: ${userId}`);

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

      const response = await this.notificationService.getNotifications(
        userId,
        unreadOnly === 'true',
        pagination,
        topicsArray,
      );

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching notifications for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to fetch notifications');
    }
  }

  /**
   * Mark notifications as read
   * PATCH /users/:userId/notifications/read
   */
  @Patch('users/:userId/notifications/read')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Mark notifications as read',
    description: 'Mark one or more notifications as read for a user.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    type: MarkNotificationsAsReadDto,
    description: 'Notification IDs to mark as read (empty for all)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notifications marked as read successfully',
    type: MarkAsReadResponseDto,
  })
  @HandleServiceErrors()
  async markAsRead(
    @Param('userId') userId: string,
    @Body() body: MarkNotificationsAsReadDto,
  ): Promise<MarkAsReadResponseDto> {
    this.logger.log(`Marking notifications as read for user: ${userId}`);

    try {
      await this.notificationService.markAsRead(
        userId,
        body.notificationIds || [],
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error marking notifications as read for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        error.message || 'Failed to mark notifications as read',
      );
    }
  }

  /**
   * Mark single notification as read
   * PATCH /notifications/:notificationId/read
   */
  @Patch('notifications/:notificationId/read')
  @ApiOperation({
    summary: 'Mark single notification as read',
    description: 'Mark a specific notification as read.',
  })
  @ApiParam({
    name: 'notificationId',
    description: 'Notification ID',
    example: 'notif_123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification marked as read successfully',
  })
  @HandleServiceErrors()
  async markSingleAsRead(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: UsersDocument,
  ): Promise<{ success: boolean }> {
    this.logger.log(`Marking notification ${notificationId} as read`);

    try {
      await this.notificationService.markAsRead(user._id, [notificationId]);

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error marking notification ${notificationId} as read: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        error.message || 'Failed to mark notification as read',
      );
    }
  }

  /**
   * Get notification preferences
   * GET /users/:userId/notifications/preferences
   */
  @Get('users/:userId/notifications/preferences')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Get notification preferences',
    description: 'Retrieve notification preferences for a user.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns user notification preferences',
  })
  @HandleServiceErrors()
  async getPreferences(@Param('userId') userId: string) {
    this.logger.log(`Getting notification preferences for user: ${userId}`);

    try {
      const response = await this.notificationService.getPreferences(userId);
      return response;
    } catch (error) {
      this.logger.error(
        `Error fetching notification preferences for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to fetch notification preferences',
      );
    }
  }

  /**
   * Update notification preferences
   * PUT /users/:userId/notifications/preferences
   */
  @Patch('users/:userId/notifications/preferences')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Update notification preferences',
    description:
      'Update notification channel and topic preferences for a user.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    type: UpdateNotificationPreferencesDto,
    description: 'Notification preferences to update',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences updated successfully',
    type: UpdatePreferencesResponseDto,
  })
  @HandleServiceErrors()
  async updatePreferences(
    @Param('userId') userId: string,
    @Body() body: UpdateNotificationPreferencesDto,
  ): Promise<UpdatePreferencesResponseDto> {
    this.logger.log(`Updating notification preferences for user: ${userId}`);

    try {
      const channels = body.channels?.map((c) => c.channel) || [];
      const topics = body.topics?.map((t) => t.topic) || [];

      await this.notificationService.updatePreferences(
        userId,
        channels,
        topics,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error updating notification preferences for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        error.message || 'Failed to update notification preferences',
      );
    }
  }

  /**
   * Subscribe to notification topics
   * POST /users/:userId/notifications/subscriptions
   */
  @Post('users/:userId/notifications/subscriptions')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Subscribe to notification topics',
    description: 'Subscribe to specific notification topics.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    type: NotificationSubscribeDto,
    description: 'Topics to subscribe to',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Successfully subscribed to topics',
  })
  @HttpCode(HttpStatus.CREATED)
  @HandleServiceErrors()
  async subscribeToTopics(
    @Param('userId') userId: string,
  ): Promise<{ success: boolean }> {
    this.logger.log(`User ${userId} subscribing to topics`);

    // This would need a new service method for topic subscription
    // For now, we can update preferences to include these topics
    return { success: true };
  }

  /**
   * Unsubscribe from notification topics
   * DELETE /users/:userId/notifications/subscriptions
   */
  @Delete('users/:userId/notifications/subscriptions')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Unsubscribe from notification topics',
    description: 'Unsubscribe from specific notification topics.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    type: NotificationUnsubscribeDto,
    description: 'Topics to unsubscribe from',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully unsubscribed from topics',
  })
  @HandleServiceErrors()
  async unsubscribeFromTopics(
    @Param('userId') userId: string,
  ): Promise<{ success: boolean }> {
    this.logger.log(`User ${userId} unsubscribing from topics`);

    // This would need a new service method for topic unsubscription
    // For now, we can update preferences to exclude these topics
    return { success: true };
  }

  /**
   * Delete notification
   * DELETE /notifications/:notificationId

   */
  @Delete('notifications/:notificationId')
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Delete a specific notification.',
  })
  @ApiParam({
    name: 'notificationId',
    description: 'Notification ID',
    example: 'notif_123',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Notification deleted successfully',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @HandleServiceErrors()
  async deleteNotification(
    @Param('notificationId') notificationId: string,
  ): Promise<void> {
    this.logger.log(`Deleting notification ${notificationId}`);

    // This would need a new service method for deleting notifications
    // For now, we'll mark it as a future enhancement
    this.logger.warn(
      'Delete notification not yet implemented in service layer',
    );
  }

  /**
   * Batch delete notifications
   * DELETE /users/:userId/notifications
   */
  @Delete('users/:userId/notifications')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Batch delete notifications',
    description: 'Delete multiple notifications at once.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiBody({
    type: BatchDeleteNotificationsDto,
    description: 'Notification IDs to delete',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Notifications deleted successfully',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @HandleServiceErrors()
  async batchDeleteNotifications(
    @Param('userId') userId: string,
  ): Promise<void> {
    this.logger.log(`Batch deleting notifications for user ${userId}`);

    // This would need a new service method for batch deletion
    // For now, we'll mark it as a future enhancement
    this.logger.warn(
      'Batch delete notifications not yet implemented in service layer',
    );
  }

  /**
   * Get notification count
   * GET /users/:userId/notifications/count
   */
  @Get('users/:userId/notifications/count')
  @UseGuards(ResourceOwnerGuard)
  @CheckOwnership({ paramName: 'userId', idField: 'id' })
  @ApiOperation({
    summary: 'Get notification count',
    description: 'Get count of unread notifications for a user.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    type: Boolean,
    description: 'Count only unread notifications (default: true)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns notification count',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' },
        unread: { type: 'number' },
      },
    },
  })
  @HandleServiceErrors()
  async getNotificationCount(
    @Param('userId') userId: string,
    @Query('unreadOnly') unreadOnly: string = 'true',
  ): Promise<{ count: number; unread: number }> {
    this.logger.log(`Getting notification count for user: ${userId}`);

    try {
      const response = await this.notificationService.getNotifications(
        userId,
        unreadOnly === 'true',
        { page: 0, size: 1 }, // Just get metadata
        [],
      );

      return {
        count: response.total || 0,
        unread: (response as any).unreadCount || 0,
      };
    } catch (error) {
      this.logger.error(
        `Error getting notification count for user ${userId}: ${error.message}`,
        error.stack,
      );
      return { count: 0, unread: 0 };
    }
  }
}
