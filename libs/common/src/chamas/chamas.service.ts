import { Injectable, Logger } from '@nestjs/common';
import {
  CreateChamaDto,
  FilterChamasDto,
  FindChamaDto,
  InviteMembersDto,
  JoinChamaDto,
  UpdateChamaDto,
} from '../dto';
import { type Chama } from '../types';
import { ChamasRepository } from './chamas.repository';

export interface IChamasService {
  createChama(req: CreateChamaDto): Promise<Chama>;

  updateChama(req: UpdateChamaDto): Promise<Chama>;

  joinChama(req: JoinChamaDto): Promise<Chama>;

  inviteMembers(req: InviteMembersDto): Promise<Chama>;

  findChama(req: FindChamaDto): Promise<Chama>;

  filterChamas(req: FilterChamasDto): Promise<Chama[]>;
}

@Injectable()
export class ChamasService implements IChamasService {
  private readonly logger = new Logger(ChamasService.name);

  constructor(private readonly chamas: ChamasRepository) {
    this.logger.debug('ChamasService initialized');
  }

  createChama(req: CreateChamaDto): Promise<Chama> {
    throw new Error('Method not implemented.');
  }

  updateChama(req: UpdateChamaDto): Promise<Chama> {
    throw new Error('Method not implemented.');
  }

  joinChama(req: JoinChamaDto): Promise<Chama> {
    throw new Error('Method not implemented.');
  }

  inviteMembers(req: InviteMembersDto): Promise<Chama> {
    throw new Error('Method not implemented.');
  }

  findChama(req: FindChamaDto): Promise<Chama> {
    throw new Error('Method not implemented.');
  }

  filterChamas(req: FilterChamasDto): Promise<Chama[]> {
    throw new Error('Method not implemented.');
  }
}
