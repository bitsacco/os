import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChamasRepository } from './chamas.repository';

export interface IChamasService {
  createChama(): Promise<{}>;

  updateChama(id: string, updates: Object): Promise<{}>;

  findChama(): Promise<{}>;

  listChamas(): Promise<{}[]>;

  joinChama(): Promise<{}[]>;
}

@Injectable()
export class ChamasService implements IChamasService {
  private readonly logger = new Logger(ChamasService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly users: ChamasRepository,
  ) {
    this.logger.debug('ChamasService initialized');
  }
  createChama(): Promise<{}> {
    throw new Error('Method not implemented.');
  }
  updateChama(id: string, updates: Object): Promise<{}> {
    throw new Error('Method not implemented.');
  }
  findChama(): Promise<{}> {
    throw new Error('Method not implemented.');
  }
  listChamas(): Promise<{}[]> {
    throw new Error('Method not implemented.');
  }
  joinChama(): Promise<{}[]> {
    throw new Error('Method not implemented.');
  }
}
