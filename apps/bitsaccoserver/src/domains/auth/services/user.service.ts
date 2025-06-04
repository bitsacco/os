import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as argon2 from 'argon2';
import { BaseDomainService } from '../../../shared/domain/base-domain.service';
import { BusinessMetricsService } from '../../../infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../../infrastructure/monitoring/telemetry.service';
import { UserRepository } from '../repositories/user.repository';

export interface CreateUserDto {
  phone: string;
  name: string;
  email?: string;
  npub?: string;
  role: string;
  status: string;
  isPhoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UserService extends BaseDomainService {
  constructor(
    protected readonly eventEmitter: EventEmitter2,
    protected readonly metricsService: BusinessMetricsService,
    protected readonly telemetryService: TelemetryService,
    private readonly userRepository: UserRepository,
  ) {
    super(eventEmitter, metricsService, telemetryService);
  }

  async create(userData: CreateUserDto): Promise<any> {
    return this.executeWithErrorHandling('create', async () => {
      const userDoc = {
        pinHash: 'default_pin_hash',
        otpHash: 'default_otp_hash',
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        phone: {
          number: userData.phone,
          verified: userData.isPhoneVerified,
        },
        nostr: userData.npub
          ? {
              npub: userData.npub,
              verified: false,
            }
          : undefined,
        profile: {
          name: userData.name,
          avatarUrl: undefined,
        },
        roles: [0], // Member role
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return this.userRepository.create(userDoc);
    });
  }

  async findByPhone(phone: string): Promise<any> {
    return this.executeWithErrorHandling('findByPhone', async () => {
      return this.userRepository.findOne({ phone });
    });
  }

  async findById(id: string): Promise<any> {
    return this.executeWithErrorHandling('findById', async () => {
      const user = await this.userRepository.findOne({ _id: id });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    });
  }

  async updateUser(id: string, updates: Partial<CreateUserDto>): Promise<any> {
    return this.executeWithErrorHandling('updateUser', async () => {
      return this.userRepository.findOneAndUpdate(
        { _id: id },
        { ...updates, updatedAt: new Date() },
      );
    });
  }

  async update(id: string, updates: any): Promise<any> {
    return this.executeWithErrorHandling('update', async () => {
      return this.userRepository.findOneAndUpdate(
        { _id: id },
        { ...updates, updatedAt: new Date() },
      );
    });
  }

  async findByNpub(npub: string): Promise<any> {
    return this.executeWithErrorHandling('findByNpub', async () => {
      return this.userRepository.findOne({ 'nostr.npub': npub });
    });
  }

  async validatePin(user: any, plainPin: string): Promise<boolean> {
    return this.executeWithErrorHandling('validatePin', async () => {
      try {
        return await argon2.verify(user.pin || user.pinHash, plainPin);
      } catch (error) {
        return false;
      }
    });
  }

  async hashPin(plainPin: string): Promise<string> {
    return this.executeWithErrorHandling('hashPin', async () => {
      return await argon2.hash(plainPin, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16, // 64 MB
        timeCost: 3,
        parallelism: 1,
      });
    });
  }
}
