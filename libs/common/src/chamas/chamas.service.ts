import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  CreateChamaDto,
  FilterChamasDto,
  FindChamaDto,
  InviteMembersDto,
  JoinChamaDto,
  UpdateChamaDto,
} from '../dto';
import { toChama } from '../database';
import { type ChamaInvite, type ChamaMember, type Chama } from '../types';
import { UsersService } from '../users';
import { ChamasRepository } from './chamas.repository';
import { ChamaMessageService } from './chamas.messaging';

interface ChamaFilter {
  createdBy?: string;
  members?: { $elemMatch: { memberId: string } };
}

interface ResolvedMembers {
  registered: ChamaMember[];
  nonRegistered: ChamaMember[];
}

@Injectable()
export class ChamasService {
  private readonly logger = new Logger(ChamasService.name);

  constructor(
    private readonly chamas: ChamasRepository,
    private readonly users: UsersService,
    private readonly messenger: ChamaMessageService,
  ) {
    this.logger.debug('ChamasService initialized');
  }

  async createChama({
    name,
    description,
    members,
    invites,
    createdBy,
  }: CreateChamaDto): Promise<Chama> {
    const { registered, nonRegistered } = await this.resolveMembers(members);

    if (!registered.find((member) => member.userId === createdBy)) {
      throw new BadRequestException('Failed to create chama', {
        cause: new Error('Invalid chama creator'),
        description:
          'Seems the proposed chama creator, is not yet a registered member',
      });
    }

    if (nonRegistered.length) {
      this.logger.error('Attempted to register unknown users as chama member');
    }

    const cd = await this.chamas.create({
      name,
      description,
      members: registered,
      createdBy,
    });
    const chama = toChama(cd);

    this.messenger.sendChamaInvites(chama, invites);

    return chama;
  }

  private async resolveMembers(
    proposed: ChamaMember[],
  ): Promise<ResolvedMembers> {
    if (!proposed.length) {
      return { registered: [], nonRegistered: [] };
    }

    const uniqueMembers = [
      ...new Map(proposed.map((member) => [member.userId, member])).values(),
    ];

    try {
      const userIds = uniqueMembers.map((member) => member.userId);
      const existingUsers = await this.users.findUsersById(new Set(userIds));

      const existingUserIds = new Set(existingUsers.map((user) => user.id));

      return uniqueMembers.reduce<ResolvedMembers>(
        (acc, member) => {
          if (existingUserIds.has(member.userId)) {
            acc.registered.push(member);
          } else {
            acc.nonRegistered.push(member);
          }
          return acc;
        },
        { registered: [], nonRegistered: [] },
      );
    } catch (error) {
      this.logger.error('Failed to resolve members', {
        error,
        proposedMembers: uniqueMembers,
      });
      throw new InternalServerErrorException('Failed to verify members');
    }
  }

  private deduplicateMembers(current: ChamaMember[], updates: ChamaMember[]) {
    return [...current, ...updates].filter(
      (member, index, self) =>
        index === self.findIndex((m) => m.userId === member.userId),
    );
  }

  async updateChama({ chamaId, updates }: UpdateChamaDto): Promise<Chama> {
    const cd = await this.chamas.findOne({ _id: chamaId });

    const hunk: Partial<Chama> = {};

    if (updates.name) {
      hunk.name = updates.name;
    }

    if (updates.description) {
      hunk.description = updates.description;
    }

    if (updates.members) {
      const { registered, nonRegistered } = await this.resolveMembers(
        updates.members,
      );
      hunk.members = this.deduplicateMembers(cd.members, registered);

      if (nonRegistered.length) {
        this.logger.error(
          'Attempted to register unknown users as chama member',
        );
      }
    }

    const updatedChama = await this.chamas.findOneAndUpdate(
      { _id: chamaId },
      hunk,
    );

    return toChama(updatedChama);
  }

  async joinChama({ chamaId, memberInfo }: JoinChamaDto): Promise<Chama> {
    const cd = await this.chamas.findOne({ _id: chamaId });
    const hunk: Partial<Chama> = {
      members: this.deduplicateMembers(cd.members, [memberInfo]),
    };

    const updatedChama = await this.chamas.findOneAndUpdate(
      { _id: chamaId },
      hunk,
    );

    return toChama(updatedChama);
  }

  async inviteMembers({ chamaId, invites }: InviteMembersDto): Promise<Chama> {
    const cd = await this.chamas.findOne({ _id: chamaId });
    const chama = toChama(cd);

    this.messenger.sendChamaInvites(chama, invites);
    return toChama(cd);
  }

  async findChama({ chamaId }: FindChamaDto): Promise<Chama> {
    const cd = await this.chamas.findOne({ _id: chamaId });
    return toChama(cd);
  }

  async filterChamas({
    createdBy,
    memberId,
  }: FilterChamasDto): Promise<Chama[]> {
    const filter: ChamaFilter = {};

    if (createdBy) {
      filter.createdBy = createdBy;
    }

    if (memberId) {
      filter.members = { $elemMatch: { memberId: memberId } };
    }

    const cds = await this.chamas.find(filter);

    return cds.map(toChama);
  }
}
