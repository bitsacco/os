import { Controller, Get } from '@nestjs/common';
import { SharesService } from './shares.service';

@Controller()
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Get()
  getHello(): string {
    return this.sharesService.getHello();
  }
}
