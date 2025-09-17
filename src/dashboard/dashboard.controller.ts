import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
  Logger,
  Sse,
  MessageEvent,
  Post,
  Body,
  Param,
  Res,
  Query,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { JwtAuthGuard, Role } from '../common';
import { Roles } from '../common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  DashboardService,
  DashboardOverviewResponse,
  UserAnalyticsResponse,
  FinancialAnalyticsResponse,
  OperationalMetricsResponse,
} from './dashboard.service';
import { Observable, interval, mergeMap, catchError, of } from 'rxjs';
import type { Response } from 'express';

/**
 * Standard API Response Interface
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
  timestamp: string;
  meta?: {
    cached: boolean;
    cacheAge: number;
    dataSource: 'realtime' | 'aggregated' | 'cached';
  };
}

/**
 * Custom Date Range Analytics Request
 */
export interface CustomAnalyticsRequest {
  startDate: string;
  endDate: string;
  metrics: string[];
  granularity: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Export Request Interface
 */
export interface ExportRequest {
  format: 'csv' | 'xlsx' | 'pdf' | 'json';
  dataType: 'overview' | 'users' | 'financial' | 'operations' | 'all';
  dateRange?: {
    start: string;
    end: string;
  };
  filters?: Record<string, any>;
  includeCharts?: boolean;
}

/**
 * Export Response Interface
 */
export interface ExportResponse {
  exportId: string;
  status: 'processing' | 'completed' | 'failed';
  estimatedCompletion?: string;
  downloadUrl?: string;
}

/**
 * Export Status Response Interface
 */
export interface ExportStatusResponse {
  exportId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Dashboard Metrics Controller
 * Provides REST API endpoints for the admin dashboard
 */
@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get dashboard overview metrics
   */
  @Get('overview')
  @Roles(Role.Admin, Role.SuperAdmin)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5 minutes
  @ApiOperation({ summary: 'Get dashboard overview metrics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview data retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async getOverview(): Promise<ApiResponse<DashboardOverviewResponse>> {
    try {
      this.logger.log('Fetching dashboard overview metrics');

      const startTime = Date.now();
      const overview = await this.dashboardService.getOverviewMetrics();
      const processingTime = Date.now() - startTime;

      this.logger.log(`Dashboard overview retrieved in ${processingTime}ms`);

      return {
        success: true,
        data: overview,
        message: 'Dashboard overview retrieved successfully',
        timestamp: new Date().toISOString(),
        meta: {
          cached: false,
          cacheAge: 0,
          dataSource: 'realtime',
        },
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard overview', error);
      return {
        success: false,
        data: {} as DashboardOverviewResponse,
        message: 'Failed to retrieve dashboard overview',
        errors: [error.message],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get user analytics data
   */
  @Get('users')
  @Roles(Role.Admin, Role.SuperAdmin)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(600) // 10 minutes
  @ApiOperation({ summary: 'Get user analytics data' })
  @ApiResponse({
    status: 200,
    description: 'User analytics data retrieved successfully',
  })
  async getUserAnalytics(): Promise<ApiResponse<UserAnalyticsResponse>> {
    try {
      this.logger.log('Fetching user analytics');

      const startTime = Date.now();
      const analytics = await this.dashboardService.getUserAnalytics();
      const processingTime = Date.now() - startTime;

      this.logger.log(`User analytics retrieved in ${processingTime}ms`);

      return {
        success: true,
        data: analytics,
        message: 'User analytics retrieved successfully',
        timestamp: new Date().toISOString(),
        meta: {
          cached: false,
          cacheAge: 0,
          dataSource: 'aggregated',
        },
      };
    } catch (error) {
      this.logger.error('Failed to get user analytics', error);
      return {
        success: false,
        data: {} as UserAnalyticsResponse,
        message: 'Failed to retrieve user analytics',
        errors: [error.message],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get financial analytics data
   */
  @Get('financial')
  @Roles(Role.Admin, Role.SuperAdmin)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180) // 3 minutes
  @ApiOperation({ summary: 'Get financial analytics data' })
  @ApiResponse({
    status: 200,
    description: 'Financial analytics data retrieved successfully',
  })
  async getFinancialAnalytics(): Promise<
    ApiResponse<FinancialAnalyticsResponse>
  > {
    try {
      this.logger.log('Fetching financial analytics');

      const startTime = Date.now();
      const analytics = await this.dashboardService.getFinancialAnalytics();
      const processingTime = Date.now() - startTime;

      this.logger.log(`Financial analytics retrieved in ${processingTime}ms`);

      return {
        success: true,
        data: analytics,
        message: 'Financial analytics retrieved successfully',
        timestamp: new Date().toISOString(),
        meta: {
          cached: false,
          cacheAge: 0,
          dataSource: 'aggregated',
        },
      };
    } catch (error) {
      this.logger.error('Failed to get financial analytics', error);
      return {
        success: false,
        data: {} as FinancialAnalyticsResponse,
        message: 'Failed to retrieve financial analytics',
        errors: [error.message],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get operational metrics data
   */
  @Get('operations')
  @Roles(Role.Admin, Role.SuperAdmin)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60) // 1 minute
  @ApiOperation({ summary: 'Get operational metrics data' })
  @ApiResponse({
    status: 200,
    description: 'Operational metrics data retrieved successfully',
  })
  async getOperationalMetrics(): Promise<
    ApiResponse<OperationalMetricsResponse>
  > {
    try {
      this.logger.log('Fetching operational metrics');

      const startTime = Date.now();
      const metrics = await this.dashboardService.getOperationalMetrics();
      const processingTime = Date.now() - startTime;

      this.logger.log(`Operational metrics retrieved in ${processingTime}ms`);

      return {
        success: true,
        data: metrics,
        message: 'Operational metrics retrieved successfully',
        timestamp: new Date().toISOString(),
        meta: {
          cached: false,
          cacheAge: 0,
          dataSource: 'realtime',
        },
      };
    } catch (error) {
      this.logger.error('Failed to get operational metrics', error);
      return {
        success: false,
        data: {} as OperationalMetricsResponse,
        message: 'Failed to retrieve operational metrics',
        errors: [error.message],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Server-Sent Events endpoint for live metrics
   */
  @Sse('live-stream')
  @Roles(Role.Admin, Role.SuperAdmin)
  @ApiOperation({
    summary: 'Stream live dashboard metrics via Server-Sent Events',
  })
  @ApiResponse({ status: 200, description: 'Live metrics stream started' })
  streamLiveMetrics(): Observable<MessageEvent> {
    this.logger.log('Starting live metrics stream');

    return interval(5000).pipe(
      // Update every 5 seconds
      mergeMap(async () => {
        try {
          const liveData = await this.dashboardService.getLiveMetrics();
          return {
            data: JSON.stringify(liveData),
            type: 'metrics-update',
            id: Date.now().toString(),
          } as MessageEvent;
        } catch (error) {
          this.logger.error('Error in live metrics stream', error);
          return {
            data: JSON.stringify({
              error: 'Failed to retrieve live metrics',
              timestamp: new Date().toISOString(),
            }),
            type: 'error',
            id: Date.now().toString(),
          } as MessageEvent;
        }
      }),
      catchError((error) => {
        this.logger.error('Live metrics stream error', error);
        return of({
          data: JSON.stringify({ error: 'Stream error' }),
          type: 'error',
          id: Date.now().toString(),
        } as MessageEvent);
      }),
    );
  }

  /**
   * Get custom analytics for specific date range
   */
  @Get('analytics/custom')
  @Roles(Role.Admin, Role.SuperAdmin)
  @ApiOperation({ summary: 'Get custom analytics for specific date range' })
  @ApiResponse({
    status: 200,
    description: 'Custom analytics retrieved successfully',
  })
  async getCustomAnalytics(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Query('metrics') metrics: string,
    @Query('granularity')
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<ApiResponse<any>> {
    try {
      this.logger.log('Fetching custom analytics', {
        startDate,
        endDate,
        metrics,
        granularity,
      });

      // TODO: Implement custom analytics logic
      const customData = {
        dateRange: { start: startDate, end: endDate, granularity },
        metrics: {},
        message: 'Custom analytics feature is under development',
      };

      return {
        success: true,
        data: customData,
        message: 'Custom analytics retrieved successfully',
        timestamp: new Date().toISOString(),
        meta: {
          cached: false,
          cacheAge: 0,
          dataSource: 'aggregated',
        },
      };
    } catch (error) {
      this.logger.error('Failed to get custom analytics', error);
      return {
        success: false,
        data: {},
        message: 'Failed to retrieve custom analytics',
        errors: [error.message],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Export dashboard data
   */
  @Post('export')
  @Roles(Role.Admin, Role.SuperAdmin)
  @ApiOperation({ summary: 'Export dashboard data in various formats' })
  @ApiResponse({
    status: 200,
    description: 'Export request submitted successfully',
  })
  async exportDashboardData(
    @Body() exportRequest: ExportRequest,
  ): Promise<ApiResponse<ExportResponse>> {
    try {
      this.logger.log('Export request received', exportRequest);

      // Basic validation
      if (!exportRequest || !exportRequest.format || !exportRequest.dataType) {
        throw new Error('Invalid export request: missing required fields');
      }

      // TODO: Implement actual export functionality
      const exportId = `export_${Date.now()}`;

      const response: ExportResponse = {
        exportId,
        status: 'processing',
        estimatedCompletion: new Date(Date.now() + 60000).toISOString(),
      };

      return {
        success: true,
        data: response,
        message: 'Export request submitted successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to submit export request', error);
      return {
        success: false,
        data: {} as ExportResponse,
        message: 'Failed to submit export request',
        errors: [error.message],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get export status
   */
  @Get('export/:exportId/status')
  @Roles(Role.Admin, Role.SuperAdmin)
  @ApiOperation({ summary: 'Get export status' })
  @ApiResponse({
    status: 200,
    description: 'Export status retrieved successfully',
  })
  async getExportStatus(
    @Param('exportId') exportId: string,
  ): Promise<ApiResponse<ExportStatusResponse>> {
    try {
      this.logger.log(`Getting export status for ${exportId}`);

      // TODO: Implement actual export status tracking
      const status: ExportStatusResponse = {
        exportId,
        status: 'completed',
        progress: 100,
        downloadUrl: `/api/v1/dashboard/export/${exportId}/download`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: status,
        message: 'Export status retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get export status', error);
      return {
        success: false,
        data: {} as ExportStatusResponse,
        message: 'Failed to retrieve export status',
        errors: [error.message],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Download exported data
   */
  @Get('export/:exportId/download')
  @Roles(Role.Admin, Role.SuperAdmin)
  @ApiOperation({ summary: 'Download exported data' })
  @ApiResponse({
    status: 200,
    description: 'Export file downloaded successfully',
  })
  async downloadExport(
    @Param('exportId') exportId: string,
    @Res() response: Response,
  ) {
    try {
      this.logger.log(`Downloading export ${exportId}`);

      // TODO: Implement actual file download
      const mockData = JSON.stringify(
        {
          exportId,
          data: 'Mock export data',
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      );

      response.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="dashboard-export-${exportId}.json"`,
        'Content-Length': Buffer.byteLength(mockData).toString(),
      });

      response.send(mockData);
    } catch (error) {
      this.logger.error('Failed to download export', error);
      response.status(500).json({
        success: false,
        message: 'Failed to download export',
        errors: [error.message],
        timestamp: new Date().toISOString(),
      });
    }
  }
}
