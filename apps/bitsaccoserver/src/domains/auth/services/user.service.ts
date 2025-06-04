import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
        nostr: userData.npub ? {
          npub: userData.npub,
          verified: false,
        } : undefined,
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
      return this.userRepository.findOne({ _id: id });
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
}
