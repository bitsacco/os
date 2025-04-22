import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, Role, ServiceRegistryService } from '@bitsacco/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Controller('admin/api-keys/rotation')
@UseGuards(JwtAuthGuard)
@Roles(Role.Admin)
export class ApiKeyRotationController {
  constructor(
    private readonly serviceRegistry: ServiceRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post(':serviceName')
  async rotateServiceApiKey(@Param('serviceName') serviceName: string) {
    // Rotate the service key
    const success = await this.serviceRegistry.rotateServiceKey(serviceName);
    
    if (success) {
      // Broadcast event to notify services to refresh their keys
      this.eventEmitter.emit('api-key.rotated', {
        serviceName,
        timestamp: new Date().toISOString(),
      });
    }
    
    return { success };
  }
  
  @Post('schedule')
  async scheduleKeyRotation(@Body() schedule: any) {
    // Schedule a future rotation for non-disruptive updates
    // Implementation would depend on scheduling framework
    return { scheduled: true };
  }
}