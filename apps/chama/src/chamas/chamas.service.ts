import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  type Chama,
  type ChamaMember,
  type PaginatedFilterChamasResponse,
  default_page,
  default_page_size,
  CreateChamaDto,
  FilterChamasDto,
  FindChamaDto,
  InviteMembersDto,
  JoinChamaDto,
  UpdateChamaDto,
  UsersService,
} from '@bitsacco/common';
import { ChamasRepository, parseMemberRole, toChama } from './db';
import { ChamaMessageService } from './chamas.messaging';
@Injectable()
export class ChamasService {
  private readonly logger = new Logger(ChamasService.name);

  constructor(
    private readonly chamas: ChamasRepository,
    private readonly messenger: ChamaMessageService,
    private readonly users: UsersService,
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
    const registered = await this.resolveMembers(members);

    if (!registered.find((member) => member.userId === createdBy)) {
      throw new BadRequestException('Failed to create chama', {
        cause: new Error('Invalid chama creator'),
        description:
          'Seems the proposed chama creator, is not yet a registered member',
      });
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
  ): Promise<ChamaMember[]> {
    if (!proposed.length) {
      return [];
    }

    const uniqueMembers = [
      ...new Map(proposed.map((member) => [member.userId, member])).values(),
    ];

    try {
      const userIds = uniqueMembers.map((member) => member.userId);
      const existingUsers = await this.users.findUsersById(new Set(userIds));
      const existingUserIds = new Set(existingUsers.map((user) => user.id));

      const { registered, nonRegistered } = uniqueMembers.reduce<{
        registered: ChamaMember[];
        nonRegistered: ChamaMember[];
      }>(
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

      if (nonRegistered.length) {
        this.logger.error(
          `Attempted to register ${nonRegistered.length} unknown users as chama members`,
        );
      }

      return registered;
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

    let members: ChamaMember[] = cd.members.map((member) => ({
      userId: member.userId,
      roles: member.roles,
    }));

    if (updates.addMembers) {
      const registered = await this.resolveMembers(updates.addMembers);
      members = this.deduplicateMembers(members, registered);
    }

    if (updates.updateMembers) {
      const updatedMembers = await this.resolveMembers(updates.updateMembers);

      // For each member to update, if they exist in the current members list,
      // update their roles; otherwise ignore them
      members = members.map((current) => {
        const updated = updatedMembers.find(
          (um) => um.userId === current.userId,
        );

        if (updated) {
          // Ensure unique roles and proper enum values
          const uniqueRoles = [...new Set(updated.roles)].map((role) =>
            parseMemberRole(role.toString()),
          );

          return {
            userId: current.userId,
            roles: uniqueRoles,
          };
        }

        return current;
      });
    }

    hunk.members = members;

    const ucd = await this.chamas.findOneAndUpdate({ _id: chamaId }, hunk);

    return toChama(ucd);
  }

  async joinChama({ chamaId, memberInfo }: JoinChamaDto): Promise<Chama> {
    const cd = await this.chamas.findOne({ _id: chamaId });
    const registered = await this.resolveMembers([memberInfo]);
    const hunk: Partial<Chama> = {
      members: this.deduplicateMembers(cd.members, registered),
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
    pagination,
  }: FilterChamasDto): Promise<PaginatedFilterChamasResponse> {
    const filter: ChamaFilter = {};

    if (createdBy) {
      filter.createdBy = createdBy;
    }

    if (memberId) {
      filter.members = { $elemMatch: { userId: memberId } };
    }

    const cds = await this.chamas.find(filter);

    let { page, size } = pagination || {
      page: default_page,
      size: default_page_size,
    };

    // if size is set to 0, we should return all available data in a single page
    size = size || cds.length;

    const pages = Math.ceil(cds.length / size);

    // select the last page if requested page exceeds total pages possible
    const selectPage = page > pages ? pages - 1 : page;

    const chamas = cds
      .slice(selectPage * size, (selectPage + 1) * size)
      .map(toChama);

    return {
      chamas,
      page: selectPage,
      size,
      pages,
    };
  }
}

interface ChamaFilter {
  createdBy?: string;
  members?: { $elemMatch: { userId: string } };
}
