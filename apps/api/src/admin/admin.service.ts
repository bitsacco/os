import { BitsaccoStatus } from '@bitsacco/common';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminService {
  async getStatus(): Promise<BitsaccoStatus> {
    return {
      memberStatus: {
        hasShares: false
      },
      swapStatus: {
        isRunning: true
      },
    }
  }
}