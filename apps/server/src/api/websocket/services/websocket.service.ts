import { Injectable, Logger } from '@nestjs/common';
import { EventsGateway } from '../gateways/events.gateway';

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);

  constructor(private readonly eventsGateway: EventsGateway) {}

  async broadcastToUser(userId: string, event: any): Promise<void> {
    try {
      await this.eventsGateway.broadcastToUser(userId, event);
      this.logger.debug(`Broadcasted event to user ${userId}`, {
        event: event.type,
      });
    } catch (error) {
      this.logger.error(`Failed to broadcast to user ${userId}`, error);
    }
  }

  async broadcastToChama(chamaId: string, event: any): Promise<void> {
    try {
      await this.eventsGateway.broadcastToChama(chamaId, event);
      this.logger.debug(`Broadcasted event to chama ${chamaId}`, {
        event: event.type,
      });
    } catch (error) {
      this.logger.error(`Failed to broadcast to chama ${chamaId}`, error);
    }
  }

  async broadcastSystemMessage(message: any): Promise<void> {
    try {
      await this.eventsGateway.broadcastSystemMessage(message);
      this.logger.debug('Broadcasted system message', {
        message: message.type,
      });
    } catch (error) {
      this.logger.error('Failed to broadcast system message', error);
    }
  }
}
