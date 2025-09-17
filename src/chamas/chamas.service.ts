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
  UsersService,
  InviteMembersRequest,
  JoinChamaRequest,
  UpdateChamaRequest,
} from '../common';
import { ChamasRepository, parseMemberRole, toChama } from './db';
import { ChamaMessageService } from './chamas.messaging';
import { ChamaMetricsService } from './chama.metrics';

@Injectable()
export class ChamasService {
  private readonly logger = new Logger(ChamasService.name);

  constructor(
    private readonly chamas: ChamasRepository,
    private readonly messenger: ChamaMessageService,
    private readonly users: UsersService,
    private readonly metricsService: ChamaMetricsService,
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
    const startTime = Date.now();
    let errorType: string | undefined;

    try {
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
        __v: 0,
      });
      const chama = toChama(cd);

      this.messenger.sendChamaInvites(chama, invites);

      // Record successful chama creation metrics
      this.metricsService.recordChamaCreationMetric({
        chamaId: chama.id,
        createdById: createdBy,
        memberCount: registered.length,
        success: true,
        duration: Date.now() - startTime,
      });

      return chama;
    } catch (error) {
      errorType = error.message || 'Unknown error';
      this.logger.error(`Chama creation failed: ${errorType}`, error.stack);

      // Record failed chama creation metrics
      this.metricsService.recordChamaCreationMetric({
        chamaId: 'unknown',
        createdById: createdBy,
        memberCount: members.length,
        success: false,
        duration: Date.now() - startTime,
        errorType,
      });

      throw error;
    }
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

  async updateChama({ chamaId, updates }: UpdateChamaRequest): Promise<Chama> {
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

  async joinChama({ chamaId, memberInfo }: JoinChamaRequest): Promise<Chama> {
    const startTime = Date.now();
    let errorType: string | undefined;

    try {
      const cd = await this.chamas.findOne({ _id: chamaId });
      const registered = await this.resolveMembers([memberInfo]);
      const hunk: Partial<Chama> = {
        members: this.deduplicateMembers(cd.members, registered),
      };

      const updatedChama = await this.chamas.findOneAndUpdate(
        { _id: chamaId },
        hunk,
      );

      const chama = toChama(updatedChama);

      // Record successful membership metrics
      this.metricsService.recordMembershipMetric({
        chamaId,
        memberId: memberInfo.userId,
        operation: 'join',
        success: true,
        duration: Date.now() - startTime,
      });

      // Record chama size metrics
      this.metricsService.recordChamaCreationMetric({
        chamaId,
        createdById: chama.createdBy,
        memberCount: chama.members.length,
        success: true,
        duration: 0, // Not a creation operation, just updating the size metric
      });

      return chama;
    } catch (error) {
      errorType = error.message || 'Unknown error';
      this.logger.error(`Join chama failed: ${errorType}`, error.stack);

      // Record failed membership metrics
      this.metricsService.recordMembershipMetric({
        chamaId,
        memberId: memberInfo.userId,
        operation: 'join',
        success: false,
        duration: Date.now() - startTime,
        errorType,
      });

      throw error;
    }
  }

  async inviteMembers({
    chamaId,
    invites,
  }: InviteMembersRequest): Promise<Chama> {
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

    try {
      this.logger.debug(
        `Filtering chamas with filter: ${JSON.stringify(filter)}`,
      );
      // Fetch all chamas matching the filter
      const cds = await this.chamas.find(filter);

      const { page } = pagination || {
        page: default_page,
        size: default_page_size,
      };
      let { size } = pagination || {
        page: default_page,
        size: default_page_size,
      };

      // if size is set to 0, we should return all available data in a single page
      size = size || cds.length || default_page_size;

      // Handle empty results case
      const totalItems = cds.length;
      const pages = Math.max(1, Math.ceil(totalItems / size));

      // Handle pagination edge cases
      // If page is out of bounds or invalid, default to page 0
      const selectPage = !page || page < 0 || page >= pages ? 0 : page;

      const chamas =
        totalItems > 0
          ? cds.slice(selectPage * size, (selectPage + 1) * size).map(toChama)
          : [];

      return {
        chamas,
        page: selectPage,
        size,
        pages,
        total: totalItems,
      };
    } catch (error) {
      this.logger.error(
        `Error filtering chamas: ${error.message}`,
        error.stack,
      );
      // Return empty result instead of throwing an error
      return {
        chamas: [],
        page: 0,
        size: pagination?.size || default_page_size,
        pages: 0,
        total: 0,
      };
    }
  }

  async getMemberProfiles({ chamaId }): Promise<{ members: Array<any> }> {
    try {
      // Get the chama to access its members
      const cd = await this.chamas.findOne({ _id: chamaId });
      if (!cd) {
        throw new BadRequestException(`Chama with ID ${chamaId} not found`);
      }

      // Extract user IDs from chama members
      const userIds = cd.members.map((member) => member.userId);

      // Fetch user profiles from the users service
      const users = await this.users.findUsersById(new Set(userIds));

      // Map chama members to their profiles
      const memberProfiles = cd.members.map((member) => {
        const user = users.find((u) => u.id === member.userId);
        return {
          userId: member.userId,
          roles: member.roles.map((role) =>
            typeof role === 'string' ? parseInt(role, 10) : role,
          ),
          name: user?.profile?.name,
          avatarUrl: user?.profile?.avatarUrl,
          phoneNumber: user?.phone?.number,
          nostrNpub: user?.nostr?.npub,
        };
      });

      return { members: memberProfiles };
    } catch (error) {
      this.logger.error(
        `Error getting member profiles for chama ${chamaId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

interface ChamaFilter {
  createdBy?: string;
  members?: { $elemMatch: { userId: string } };
}
