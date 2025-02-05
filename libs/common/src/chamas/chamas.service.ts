import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import {
  AddMembersDto,
  CreateChamaDto,
  FilterChamasDto,
  FindChamaDto,
  JoinChamaDto,
  UpdateChamaDto,
} from '../dto';
import { type Chama } from '../types';
import { ChamasRepository } from './chamas.repository';

export interface IChamasService {
  createChama(req: CreateChamaDto): Promise<Chama>;

  updateChama(req: UpdateChamaDto): Promise<Chama>;

  joinChama(req: JoinChamaDto): Promise<Chama>;

  addMembers(req: AddMembersDto): Promise<Chama>;

  findChama(req: FindChamaDto): Promise<Chama>;

  listChamas(req: FilterChamasDto): Promise<Chama[]>;
}

@Injectable()
export class ChamasService implements IChamasService {
  private readonly logger = new Logger(ChamasService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly chamas: ChamasRepository,
  ) {
    this.logger.debug('ChamasService initialized');
  }

  createChama(req: CreateChamaDto): Promise<Chama> {
    throw new Error('Method not implemented.');
  }

  updateChama(req: UpdateChamaDto): Promise<Chama> {
    throw new Error('Method not implemented.');
  }

  joinChama(): Promise<Chama> {
    throw new Error('Method not implemented.');
  }

  addMembers(): Promise<Chama> {
    throw new Error('Method not implemented.');
  }

  findChama(req: FindChamaDto): Promise<Chama> {
    throw new Error('Method not implemented.');
  }

  listChamas(req: FilterChamasDto): Promise<Chama[]> {
    throw new Error('Method not implemented.');
  }
}
