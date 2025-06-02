import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose, { ClientSession } from 'mongoose';

export interface TransactionOperation {
  execute(session: ClientSession): Promise<any>;
  compensate?(session: ClientSession): Promise<any>;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  async executeInTransaction<T>(
    operations:
      | TransactionOperation[]
      | ((session: ClientSession) => Promise<T>),
  ): Promise<T> {
    const session = await this.connection.startSession();

    try {
      return await session.withTransaction(async () => {
        if (typeof operations === 'function') {
          return await operations(session);
        }

        const results: any[] = [];
        const compensations: TransactionOperation[] = [];

        try {
          for (const operation of operations) {
            const result = await operation.execute(session);
            results.push(result);

            if (operation.compensate) {
              compensations.unshift(operation); // Add to front for reverse order
            }
          }

          return results as T;
        } catch (error) {
          this.logger.error(
            'Transaction failed, executing compensations',
            error,
          );

          // Execute compensating transactions in reverse order
          for (const compensation of compensations) {
            try {
              await compensation.compensate!(session);
            } catch (compensationError) {
              this.logger.error('Compensation failed', compensationError);
            }
          }

          throw error;
        }
      });
    } finally {
      await session.endSession();
    }
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Transaction attempt ${attempt} failed: ${error.message}`,
        );

        if (attempt < maxRetries) {
          await this.sleep(delay * attempt); // Exponential backoff
        }
      }
    }

    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
