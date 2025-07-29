import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LightningAddress,
  LightningAddressDocument,
} from '../schemas/lightning-address.schema';
import { LnurlCommonService } from './lnurl-common.service';
import { ChamasService } from '../../chamas/chamas.service';
import {
  AddressType,
  ParsedAddress,
  ResolvedAddress,
  isLightningAddress,
} from '../types';

@Injectable()
export class AddressResolverService {
  private readonly logger = new Logger(AddressResolverService.name);

  constructor(
    @InjectModel(LightningAddress.name)
    private readonly lightningAddressModel: Model<LightningAddressDocument>,
    private readonly lnurlCommonService: LnurlCommonService,
    private readonly chamasService: ChamasService,
  ) {}

  /**
   * Parse a Lightning Address into its components
   * @param fullAddress The full Lightning Address (e.g., "alice@bitsacco.com" or "alice-savings@bitsacco.com")
   * @returns Parsed address components
   */
  async parseAddressFormat(fullAddress: string): Promise<ParsedAddress> {
    if (!isLightningAddress(fullAddress)) {
      throw new BadRequestException('Invalid Lightning Address format');
    }

    const [localPart, domain] = fullAddress.split('@');

    // Check if it's a member-chama format (username-chamaname)
    if (localPart.includes('-')) {
      const parts = localPart.split('-');
      if (parts.length === 2) {
        const [username, chamaname] = parts;
        return {
          localPart,
          domain,
          username,
          chamaname,
        };
      }
    }

    // Standard format (username or chamaname)
    return {
      localPart,
      domain,
    };
  }

  /**
   * Resolve a Lightning Address to its destination wallet
   * @param fullAddress The full Lightning Address
   * @returns Resolved address information
   */
  async resolveAddress(fullAddress: string): Promise<ResolvedAddress> {
    const parsed = await this.parseAddressFormat(fullAddress);

    // Only handle internal domains
    if (!this.lnurlCommonService.isInternalDomain(parsed.domain)) {
      throw new BadRequestException(`Domain ${parsed.domain} is not supported`);
    }

    // Handle member-chama format
    if (parsed.username && parsed.chamaname) {
      return this.resolveMemberChamaAddress(parsed.username, parsed.chamaname);
    }

    // Handle standard format
    return this.resolveStandardAddress(parsed.localPart);
  }

  /**
   * Resolve a standard Lightning Address (personal or chama)
   * @param address The local part of the address
   * @returns Resolved address information
   */
  private async resolveStandardAddress(
    address: string,
  ): Promise<ResolvedAddress> {
    this.logger.log(`Resolving standard address: ${address}`);

    const lightningAddress = await this.lightningAddressModel.findOne({
      address: address.toLowerCase(),
      'settings.enabled': true,
    });

    if (!lightningAddress) {
      throw new NotFoundException(`Lightning Address ${address} not found`);
    }

    return {
      type: 'internal',
      addressType: lightningAddress.type,
      ownerId: lightningAddress.ownerId,
      addressId: lightningAddress._id.toString(),
      metadata: {
        identifier: `${lightningAddress.address}@${lightningAddress.domain}`,
        description: lightningAddress.metadata.description,
        minSendable: lightningAddress.metadata.minSendable,
        maxSendable: lightningAddress.metadata.maxSendable,
        commentAllowed: lightningAddress.metadata.commentAllowed,
      },
      settings: lightningAddress.settings,
    };
  }

  /**
   * Resolve a member-chama Lightning Address
   * @param username The username part
   * @param chamaname The chama name part
   * @returns Resolved address information
   */
  private async resolveMemberChamaAddress(
    username: string,
    chamaname: string,
  ): Promise<ResolvedAddress> {
    this.logger.log(`Resolving member-chama address: ${username}-${chamaname}`);

    // First, find the user's Lightning Address
    const userAddress = await this.lightningAddressModel.findOne({
      address: username.toLowerCase(),
      type: AddressType.PERSONAL,
      'settings.enabled': true,
    });

    if (!userAddress) {
      throw new NotFoundException(`User ${username} not found`);
    }

    // Then, find the chama's Lightning Address
    const chamaAddress = await this.lightningAddressModel.findOne({
      address: chamaname.toLowerCase(),
      type: AddressType.CHAMA,
      'settings.enabled': true,
    });

    if (!chamaAddress) {
      throw new NotFoundException(`Chama ${chamaname} not found`);
    }

    // Verify that the user is a member of the chama
    try {
      const chama = await this.chamasService.findChama({
        chamaId: chamaAddress.ownerId,
      });
      const isMember = chama.members.some(
        (member) => member.userId === userAddress.ownerId,
      );

      if (!isMember) {
        throw new ForbiddenException(
          `User ${username} is not a member of chama ${chamaname}`,
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Failed to verify chama membership: ${error.message}`);
      throw new NotFoundException(
        `Unable to verify membership for chama ${chamaname}`,
      );
    }

    return {
      type: 'internal',
      addressType: AddressType.MEMBER_CHAMA,
      ownerId: chamaAddress.ownerId, // Chama ID
      memberId: userAddress.ownerId, // User ID
      addressId: chamaAddress._id.toString(),
      metadata: {
        identifier: `${username}-${chamaname}@${chamaAddress.domain}`,
        description: `${userAddress.metadata.description} to ${chamaAddress.metadata.description}`,
        minSendable: chamaAddress.metadata.minSendable,
        maxSendable: chamaAddress.metadata.maxSendable,
        commentAllowed: chamaAddress.metadata.commentAllowed,
      },
      settings: chamaAddress.settings,
    };
  }

  /**
   * Check if a Lightning Address is available
   * @param address The address to check (without domain)
   * @returns True if available, false otherwise
   */
  async isAddressAvailable(address: string): Promise<boolean> {
    const normalizedAddress = address.toLowerCase().trim();

    // Check reserved words
    const reserved = [
      'admin',
      'administrator',
      'support',
      'help',
      'api',
      'www',
      'mail',
      'ftp',
      'email',
      'test',
      'root',
      'system',
      'info',
      'contact',
      'about',
      'legal',
      'terms',
      'privacy',
      'security',
      'billing',
      'payment',
      'invoice',
      'account',
      'user',
      'users',
      'chama',
      'chamas',
      'group',
      'groups',
      'wallet',
      'wallets',
      'lightning',
      'bitcoin',
      'btc',
      'sats',
      'satoshi',
      'ln',
      'lnurl',
      'bitsacco',
      'app',
      'mobile',
      'web',
      'service',
    ];

    if (reserved.includes(normalizedAddress)) {
      return false;
    }

    // Check if already taken
    const existing = await this.lightningAddressModel.findOne({
      address: normalizedAddress,
    });

    return !existing;
  }

  /**
   * Find Lightning Address by owner
   * @param ownerId The owner ID (user or chama)
   * @param type Optional address type filter
   * @returns Lightning Address if found
   */
  async findByOwner(
    ownerId: string,
    type?: AddressType,
  ): Promise<LightningAddressDocument | null> {
    const query: any = { ownerId };
    if (type) {
      query.type = type;
    }

    return this.lightningAddressModel.findOne(query);
  }

  /**
   * Find all Lightning Addresses for an owner
   * @param ownerId The owner ID
   * @returns Array of Lightning Addresses
   */
  async findAllByOwner(ownerId: string): Promise<LightningAddressDocument[]> {
    return this.lightningAddressModel.find({ ownerId });
  }
}
