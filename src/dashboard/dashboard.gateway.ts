import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { JwtAuthGuard, Roles, Role } from '../common';
import { DashboardService } from './dashboard.service';

/**
 * WebSocket Gateway for Dashboard Real-time Features
 * Provides bidirectional communication for live dashboard updates
 */
@WebSocketGateway({
  namespace: '/dashboard',
  cors: {
    origin: '*', // Configure this properly for production
    credentials: true,
  },
})
export class DashboardGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DashboardGateway.name);
  private connectedClients = new Map<string, Socket>();
  private metricsSubscriptions = new Map<string, Set<string>>();

  constructor(private readonly dashboardService: DashboardService) {}

  afterInit() {
    this.logger.log('Dashboard WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    const clientId = client.id;
    this.connectedClients.set(clientId, client);
    this.metricsSubscriptions.set(clientId, new Set());

    this.logger.log(`Client connected: ${clientId}`);

    // Send initial connection message
    client.emit('connection-established', {
      clientId,
      timestamp: new Date().toISOString(),
      message: 'Connected to dashboard real-time updates',
    });
  }

  handleDisconnect(client: Socket) {
    const clientId = client.id;
    this.connectedClients.delete(clientId);
    this.metricsSubscriptions.delete(clientId);

    this.logger.log(`Client disconnected: ${clientId}`);
  }

  /**
   * Subscribe to specific metrics updates
   */
  @SubscribeMessage('subscribe-metrics')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  handleSubscribeMetrics(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { metrics: string[] },
  ) {
    const clientId = client.id;
    const clientSubscriptions =
      this.metricsSubscriptions.get(clientId) || new Set();

    // Add new metric subscriptions
    data.metrics.forEach((metric) => {
      clientSubscriptions.add(metric);
      client.join(`metrics:${metric}`);
    });

    this.metricsSubscriptions.set(clientId, clientSubscriptions);

    this.logger.log(`Client ${clientId} subscribed to metrics:`, data.metrics);

    return {
      status: 'subscribed',
      metrics: Array.from(clientSubscriptions),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Unsubscribe from specific metrics updates
   */
  @SubscribeMessage('unsubscribe-metrics')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  handleUnsubscribeMetrics(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { metrics: string[] },
  ) {
    const clientId = client.id;
    const clientSubscriptions =
      this.metricsSubscriptions.get(clientId) || new Set();

    // Remove metric subscriptions
    data.metrics.forEach((metric) => {
      clientSubscriptions.delete(metric);
      client.leave(`metrics:${metric}`);
    });

    this.metricsSubscriptions.set(clientId, clientSubscriptions);

    this.logger.log(
      `Client ${clientId} unsubscribed from metrics:`,
      data.metrics,
    );

    return {
      status: 'unsubscribed',
      metrics: Array.from(clientSubscriptions),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Request fresh data for specific endpoint
   */
  @SubscribeMessage('request-refresh')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  async handleRefreshRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { endpoint: string; requestId?: string },
  ) {
    try {
      this.logger.log(
        `Refresh requested for endpoint: ${data.endpoint} by client: ${client.id}`,
      );

      let freshData: any;

      // Get fresh data based on endpoint
      switch (data.endpoint) {
        case 'overview':
          freshData = await this.dashboardService.getOverviewMetrics();
          break;
        case 'users':
          freshData = await this.dashboardService.getUserAnalytics();
          break;
        case 'financial':
          freshData = await this.dashboardService.getFinancialAnalytics();
          break;
        case 'operations':
          freshData = await this.dashboardService.getOperationalMetrics();
          break;
        default:
          throw new Error(`Unknown endpoint: ${data.endpoint}`);
      }

      // Send fresh data to the requesting client
      client.emit('data-refreshed', {
        endpoint: data.endpoint,
        data: freshData,
        timestamp: new Date().toISOString(),
        requestId: data.requestId || Date.now().toString(),
      });

      return {
        status: 'refreshed',
        endpoint: data.endpoint,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Error refreshing data for endpoint ${data.endpoint}:`,
        error,
      );

      client.emit('refresh-error', {
        endpoint: data.endpoint,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: data.requestId || Date.now().toString(),
      });

      return {
        status: 'error',
        endpoint: data.endpoint,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get list of active clients and their subscriptions
   */
  @SubscribeMessage('get-client-info')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  handleGetClientInfo(@ConnectedSocket() client: Socket) {
    const clientId = client.id;
    const subscriptions = this.metricsSubscriptions.get(clientId) || new Set();

    return {
      clientId,
      subscriptions: Array.from(subscriptions),
      connectedAt: new Date().toISOString(),
      totalConnectedClients: this.connectedClients.size,
    };
  }

  /**
   * Ping endpoint for connection health checks
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    const timestamp = new Date().toISOString();
    client.emit('pong', { timestamp });
    return { status: 'pong', timestamp };
  }

  /**
   * Broadcast live metrics to all subscribed clients every 5 seconds
   */
  @Interval(5000)
  async broadcastLiveMetrics() {
    if (this.connectedClients.size === 0) {
      return; // No clients connected, skip broadcast
    }

    try {
      const liveMetrics = await this.dashboardService.getLiveMetrics();

      // Broadcast to all clients subscribed to live metrics
      this.server.to('metrics:live').emit('live-metrics-update', {
        ...liveMetrics,
        connectedClients: this.connectedClients.size,
      });
    } catch (error) {
      this.logger.error('Error broadcasting live metrics:', error);

      // Send error to all connected clients
      this.server.emit('metrics-error', {
        error: 'Failed to retrieve live metrics',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Broadcast critical alerts to all connected clients
   */
  @Interval(30000) // Check every 30 seconds
  async broadcastCriticalAlerts() {
    if (this.connectedClients.size === 0) {
      return; // No clients connected, skip broadcast
    }

    try {
      // TODO: Implement actual alert checking
      const criticalAlerts = []; // Placeholder

      if (criticalAlerts.length > 0) {
        this.server.emit('critical-alert', {
          alerts: criticalAlerts,
          timestamp: new Date().toISOString(),
          severity: 'critical',
        });

        this.logger.warn(
          `Broadcasted ${criticalAlerts.length} critical alerts to ${this.connectedClients.size} clients`,
        );
      }
    } catch (error) {
      this.logger.error('Error checking for critical alerts:', error);
    }
  }

  /**
   * Broadcast system status updates
   */
  @Interval(60000) // Check every minute
  async broadcastSystemStatus() {
    if (this.connectedClients.size === 0) {
      return; // No clients connected, skip broadcast
    }

    try {
      const operationalMetrics =
        await this.dashboardService.getOperationalMetrics();

      // Broadcast system status to all clients
      this.server.emit('system-status-update', {
        health: operationalMetrics.system.health,
        performance: {
          responseTime:
            operationalMetrics.system.performance.responseTime.average,
          errorRate: operationalMetrics.system.performance.errors.errorRate,
          throughput:
            operationalMetrics.system.performance.throughput.requestsPerSecond,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Error broadcasting system status:', error);
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, event: string, data: any) {
    const client = this.connectedClients.get(clientId);
    if (client) {
      client.emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  /**
   * Broadcast message to clients subscribed to specific metric
   */
  broadcastToMetricSubscribers(metric: string, event: string, data: any) {
    this.server.to(`metrics:${metric}`).emit(event, data);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const stats = {
      totalConnections: this.connectedClients.size,
      subscriptionBreakdown: {} as Record<string, number>,
      timestamp: new Date().toISOString(),
    };

    // Count subscriptions per metric
    this.metricsSubscriptions.forEach((subscriptions) => {
      subscriptions.forEach((metric) => {
        stats.subscriptionBreakdown[metric] =
          (stats.subscriptionBreakdown[metric] || 0) + 1;
      });
    });

    return stats;
  }
}
