import { Injectable } from '@nestjs/common';

@Injectable()
export class SharesService {
  getHello(): string {
    return 'Hello World!';
  }
}
