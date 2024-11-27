import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {
    this.logger.log('AdminController initialized');
  }

  @Get('status')
  @ApiOperation({ summary: 'Get status' })
  getStatus() {
    return this.adminService.getStatus();
  }
}
