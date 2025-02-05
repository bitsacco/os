import { Injectable } from '@nestjs/common';

@Injectable()
export class ChamaService {
  getHello(): string {
    return 'Hello World!';
  }
}
