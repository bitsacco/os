import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

interface ConnectionInfo {
  id: string;
  userId?: string;
  user?: any;
  connectedAt: Date;
  lastActivity: Date;
}

@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private connections = new Map<string, ConnectionInfo>();

  async addConnection(client: Socket): Promise<void> {
    const connectionInfo: ConnectionInfo = {
      id: client.id,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    this.connections.set(client.id, connectionInfo);
    this.logger.debug(`Added connection: ${client.id}`);
  }

  async removeConnection(clientId: string): Promise<void> {
    this.connections.delete(clientId);
    this.logger.debug(`Removed connection: ${clientId}`);
  }

  async authenticateConnection(clientId: string, user: any): Promise<void> {
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.userId = user.userId;
      connection.user = user;
      connection.lastActivity = new Date();
      this.logger.debug(
        `Authenticated connection: ${clientId} for user: ${user.userId}`,
      );
    }
  }

  async updateActivity(clientId: string): Promise<void> {
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  getConnection(clientId: string): ConnectionInfo | undefined {
    return this.connections.get(clientId);
  }

  getActiveConnections(): number {
    return this.connections.size;
  }

  getAuthenticatedConnections(): number {
    return Array.from(this.connections.values()).filter((conn) => conn.userId)
      .length;
  }

  getUserConnections(userId: string): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.userId === userId,
    );
  }

  async cleanupStaleConnections(
    maxIdleTime: number = 30 * 60 * 1000,
  ): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [clientId, connection] of this.connections.entries()) {
      const idleTime = now.getTime() - connection.lastActivity.getTime();
      if (idleTime > maxIdleTime) {
        this.connections.delete(clientId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} stale connections`);
    }

    return cleaned;
  }
}
