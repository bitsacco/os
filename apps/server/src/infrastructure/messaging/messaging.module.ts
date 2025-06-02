import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services
import { EventBusService } from './event-bus.service';
import { MessageQueueService } from './message-queue.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [EventBusService, MessageQueueService],
  exports: [EventBusService, MessageQueueService],
})
export class MessagingModule {}
