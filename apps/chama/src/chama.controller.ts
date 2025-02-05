import { Controller, Get } from '@nestjs/common';
import { ChamaService } from './chama.service';

@Controller()
export class ChamaController {
  constructor(private readonly chamaService: ChamaService) {}

  @Get()
  getHello(): string {
    return this.chamaService.getHello();
  }
}
