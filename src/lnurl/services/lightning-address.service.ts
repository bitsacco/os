import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { LightningAddressDocument, LightningAddressRepository } from '../db';
import { LnurlMetricsService } from '../lnurl.metrics';
import { SolowalletService } from '../../solowallet/solowallet.service';
import { ChamaWalletService } from '../../chamawallet/wallet.service';
import { ChamasService } from '../../chamas/chamas.service';
import { LnurlCommonService } from './lnurl-common.service';
import { LnurlResolverService } from './lnurl-resolver.service';
import { LnurlTransactionService } from './lnurl-transaction.service';
import { UsersService } from '../../common/users/users.service';
import { SwapService } from '../../swap/swap.service';
import { FedimintService } from '../../common/fedimint/fedimint.service';
import {
  AddressType,
  LightningAddressMetadata,
  LightningAddressSettings,
  LnurlPayResponse,
  LnurlPayInvoiceResponse,
  PaymentOptions,
  ResolvedAddress,
  ParsedAddress,
  isLightningAddress,
  Currency,
  btcToFiat,
  LnurlTransactionDocument,
  LnurlType,
} from '../../common';

@Injectable()
export class LightningAddressService {
  private readonly logger = new Logger(LightningAddressService.name);

  constructor(
    private readonly lightningAddressRepository: LightningAddressRepository,
    private readonly lnurlCommonService: LnurlCommonService,
    private readonly lnurlMetricsService: LnurlMetricsService,
    private readonly lnurlResolverService: LnurlResolverService,
    private readonly lnurlTransactionService: LnurlTransactionService,
    private readonly solowalletService: SolowalletService,
    private readonly chamaWalletService: ChamaWalletService,
    private readonly chamasService: ChamasService,
    private readonly usersService: UsersService,
    private readonly httpService: HttpService,
    private readonly swapService: SwapService,
    private readonly configService: ConfigService,
    private readonly fedimintService: FedimintService,
  ) {}

  /**
   * Create or claim a Lightning Address
   */
  async createAddress(
    ownerId: string,
    address: string,
    type: AddressType,
    metadata?: Partial<LightningAddressMetadata>,
    settings?: Partial<LightningAddressSettings>,
  ): Promise<LightningAddressDocument> {
    this.logger.log(
      `Creating Lightning Address: ${address} for owner ${ownerId}`,
    );

    // Normalize address
    const normalizedAddress = address.toLowerCase().trim();

    // Validate address format
    if (!/^[a-zA-Z0-9._-]+$/.test(normalizedAddress)) {
      throw new BadRequestException(
        'Address can only contain letters, numbers, dots, underscores, and hyphens',
      );
    }

    if (normalizedAddress.length < 3) {
      throw new BadRequestException(
        'Address must be at least 3 characters long',
      );
    }

    if (normalizedAddress.length > 32) {
      throw new BadRequestException(
        'Address cannot be longer than 32 characters',
      );
    }

    // Check availability
    const isAvailable = await this.isAddressAvailable(normalizedAddress);
    if (!isAvailable) {
      throw new ConflictException(
        `Address ${normalizedAddress} is not available`,
      );
    }

    // Check if owner already has an address of this type
    if (type === AddressType.PERSONAL) {
      const existing = await this.findByOwner(ownerId, AddressType.PERSONAL);
      if (existing) {
        throw new ConflictException(
          'You already have a personal Lightning Address',
        );
      }

      // Update user's profile name if they don't have one
      try {
        const user = await this.usersService.findUser({ id: ownerId });
        if (!user.profile?.name) {
          await this.usersService.updateUser({
            userId: ownerId,
            updates: {
              profile: {
                name: normalizedAddress,
                avatarUrl: user.profile?.avatarUrl,
              },
              roles: user.roles,
            },
          });
          this.logger.log(
            `Updated user ${ownerId} profile name to ${normalizedAddress}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to update user profile name: ${error.message}`,
        );
        // Continue with address creation even if profile update fails
      }
    }

    // Create the Lightning Address
    const domain = this.lnurlCommonService.isInternalDomain('bitsacco.com')
      ? 'bitsacco.com'
      : 'bitsacco.com';

    const defaultMetadata: LightningAddressMetadata = {
      description:
        metadata?.description || `Pay to ${normalizedAddress}@${domain}`,
      identifier: `${normalizedAddress}@${domain}`,
      minSendable: metadata?.minSendable || 1000, // 1 sat minimum
      maxSendable: this.configService.getOrThrow<number>(
        'LNURL_MAX_SENDABLE_MSATS',
      ),
      commentAllowed: metadata?.commentAllowed || 255,
      ...metadata,
    };

    const defaultSettings: LightningAddressSettings = {
      enabled: true,
      allowComments: true,
      notifyOnPayment: true,
      ...settings,
    };

    const lightningAddress = await this.lightningAddressRepository.create({
      address: normalizedAddress,
      domain,
      type,
      ownerId,
      metadata: defaultMetadata,
      settings: defaultSettings,
      stats: {
        totalReceived: 0,
        paymentCount: 0,
      },
      __v: 0,
    });

    // Record metric
    this.lnurlMetricsService.recordLightningAddressCreated(
      type.toLowerCase() as any,
    );

    this.logger.log(
      `Lightning Address created: ${normalizedAddress}@${domain}`,
    );

    return lightningAddress;
  }

  /**
   * Get Lightning Address details
   */
  async getAddress(
    addressId: string,
    userId: string,
  ): Promise<LightningAddressDocument> {
    const address = await this.lightningAddressRepository.findOne({
      _id: addressId,
    });

    // Check ownership
    if (address.ownerId !== userId) {
      // TODO: Check if user is admin of the chama if it's a chama address
      throw new ForbiddenException(
        'You do not have access to this Lightning Address',
      );
    }

    return address;
  }

  /**
   * Update Lightning Address
   */
  async updateAddress(
    addressId: string,
    userId: string,
    updates: {
      metadata?: Partial<LightningAddressMetadata>;
      settings?: Partial<LightningAddressSettings>;
    },
  ): Promise<LightningAddressDocument> {
    // First verify ownership
    await this.getAddress(addressId, userId);

    const updateQuery: any = {};

    if (updates.metadata) {
      Object.keys(updates.metadata).forEach((key) => {
        updateQuery[`metadata.${key}`] = updates.metadata![key];
      });
    }

    if (updates.settings) {
      Object.keys(updates.settings).forEach((key) => {
        updateQuery[`settings.${key}`] = updates.settings![key];
      });
    }

    const address = await this.lightningAddressRepository.findOneAndUpdate(
      { _id: addressId },
      { $set: updateQuery },
    );

    this.logger.log(
      `Lightning Address updated: ${address.address}@${address.domain}`,
    );

    return address;
  }

  /**
   * Delete Lightning Address
   */
  async deleteAddress(addressId: string, userId: string): Promise<void> {
    // First verify ownership
    await this.getAddress(addressId, userId);

    // Soft delete by disabling
    const address = await this.lightningAddressRepository.findOneAndUpdate(
      { _id: addressId },
      { $set: { 'settings.enabled': false } },
    );

    this.logger.log(
      `Lightning Address disabled: ${address.address}@${address.domain}`,
    );
  }

  /**
   * List user's Lightning Addresses
   */
  async listUserAddresses(userId: string): Promise<LightningAddressDocument[]> {
    return this.lightningAddressRepository.find({ ownerId: userId });
  }

  /**
   * Generate LNURL-pay response for a Lightning Address
   */
  async generatePayResponse(address: string): Promise<LnurlPayResponse> {
    // First try to find the address in our database to get the correct domain
    const addressDoc = await this.lightningAddressRepository.findOne({
      address: address.toLowerCase(),
    });

    const domain = addressDoc?.domain || 'bitsacco.com';
    const fullAddress = `${address}@${domain}`;
    const resolved = await this.resolveAddress(fullAddress);

    if (resolved.type !== 'internal' || !resolved.metadata) {
      throw new NotFoundException('Lightning Address not found');
    }

    const callback = this.lnurlCommonService.getCallbackUrl(
      `/v1/lnurl/callback/${address}`,
    );
    const metadata = this.lnurlCommonService.generateMetadata(
      resolved.metadata.description || 'Bitsacco Payment',
      resolved.metadata.imageUrl,
    );

    return {
      callback,
      minSendable: resolved.metadata.minSendable,
      maxSendable: resolved.metadata.maxSendable,
      metadata,
      tag: 'payRequest',
      commentAllowed: resolved.metadata.commentAllowed,
    };
  }

  /**
   * Process payment callback
   */
  async processPaymentCallback(
    address: string,
    amountMsats: number,
    options?: PaymentOptions,
  ): Promise<LnurlPayInvoiceResponse> {
    this.logger.log(
      `Processing payment callback for ${address}, amount: ${amountMsats}`,
    );

    try {
      // Resolve the address using the stored domain
      const addressDoc = await this.lightningAddressRepository.findOne({
        address: address.toLowerCase(),
      });

      const domain = addressDoc?.domain || 'bitsacco.com';
      const fullAddress = `${address}@${domain}`;
      const resolved = await this.resolveAddress(fullAddress);

      if (resolved.type !== 'internal' || !resolved.metadata) {
        throw new NotFoundException('Lightning Address not found');
      }

      // Validate amount using configured max sendable
      const maxSendable = this.configService.get<number>(
        'LNURL_MAX_SENDABLE_MSATS',
        10_000_000_000_000,
      );

      if (
        !this.lnurlCommonService.validateAmount(
          amountMsats,
          resolved.metadata.minSendable,
          maxSendable,
        )
      ) {
        const minSats = Math.floor(resolved.metadata.minSendable / 1000);
        const maxSats = Math.floor(maxSendable / 1000);
        throw new BadRequestException(
          `Amount must be between ${resolved.metadata.minSendable} and ${maxSendable} millisatoshis (${minSats} to ${maxSats} sats). You requested ${amountMsats} millisatoshis.`,
        );
      }

      // Generate invoice using the appropriate wallet service
      const description = options?.comment
        ? `${resolved.metadata.description} - ${options.comment}`
        : resolved.metadata.description || 'Bitsacco Payment';

      let userTxsResponse: any;

      // Delegate to the appropriate wallet service based on address type
      // Pass msats directly to avoid precision loss from fiat conversion
      switch (resolved.addressType) {
        case AddressType.PERSONAL:
          // Use the existing depositFunds method with direct msats
          userTxsResponse = await this.solowalletService.depositFunds({
            userId: resolved.ownerId!,
            amountMsats,
            reference: description,
            pagination: { page: 0, size: 1 }, // We only need the first transaction
          });
          break;

        case AddressType.CHAMA:
        case AddressType.MEMBER_CHAMA:
          // Use the existing deposit method with direct msats
          userTxsResponse = await this.chamaWalletService.deposit({
            chamaId: resolved.ownerId!,
            memberId: resolved.memberId || resolved.ownerId!,
            amountMsats,
            reference: description,
            pagination: { page: 0, size: 1 }, // We only need the first transaction
          });
          break;

        default:
          throw new BadRequestException(
            `Unsupported address type: ${resolved.addressType}`,
          );
      }

      // Extract the invoice from the transaction in the ledger
      const transactions = userTxsResponse?.ledger?.transactions || [];
      if (transactions.length === 0) {
        throw new Error('No transaction found in ledger response');
      }

      const transaction = transactions[0];
      const lightningData = transaction.lightning;

      if (!lightningData || !lightningData.invoice) {
        throw new Error('No invoice found in transaction lightning data');
      }

      const invoice = lightningData.invoice;

      // Validate that the generated invoice amount matches the requested amount
      try {
        const decodedInvoice = await this.fedimintService.decode(invoice);
        const invoiceAmountMsats = Number(decodedInvoice.amountMsats);

        // Allow small tolerance for precision differences (1 msat)
        const tolerance = 1;
        if (Math.abs(invoiceAmountMsats - amountMsats) > tolerance) {
          this.logger.error(
            `Invoice amount mismatch: requested ${amountMsats} msats, got ${invoiceAmountMsats} msats from invoice`,
          );
          throw new Error(
            `Invoice amount validation failed: requested ${amountMsats} msats, but generated invoice contains ${invoiceAmountMsats} msats`,
          );
        }

        this.logger.log(
          `Invoice amount validation passed: ${invoiceAmountMsats} msats matches requested ${amountMsats} msats`,
        );
      } catch (decodeError) {
        this.logger.error(
          `Failed to decode invoice for amount validation: ${decodeError?.message || String(decodeError)}`,
        );
        // Don't block payment flow if decode fails, but log the error
      }

      // Update stats
      await this.updateAddressStats(resolved.addressId!, amountMsats);

      // Record metrics
      this.lnurlMetricsService.recordLightningAddressPayment(
        resolved.addressType?.toLowerCase() as any,
        'success',
        amountMsats,
      );

      // Return response
      const successMessage =
        resolved.settings?.customSuccessMessage ||
        `Payment received! Thank you for paying ${address}.`;

      return {
        pr: invoice,
        routes: [],
        successAction: this.lnurlCommonService.formatSuccessAction(
          'message',
          successMessage,
        ),
      };
    } catch (error) {
      this.logger.error(`Failed to process payment callback: ${error.message}`);

      // Record failure metric
      this.lnurlMetricsService.recordLightningAddressPayment(
        'unknown' as any,
        'failed',
      );

      throw error;
    }
  }

  /**
   * Find Lightning Address by ID
   */
  async findById(addressId: string): Promise<LightningAddressDocument | null> {
    try {
      return await this.lightningAddressRepository.findOne({ _id: addressId });
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update Lightning Address statistics
   */
  private async updateAddressStats(
    addressId: string,
    amountMsats: number,
  ): Promise<void> {
    await this.lightningAddressRepository.findOneAndUpdate(
      { _id: addressId },
      {
        $inc: {
          'stats.totalReceived': amountMsats,
          'stats.paymentCount': 1,
        },
        $set: {
          'stats.lastPaymentAt': new Date(),
        },
      },
    );
  }

  /**
   * Parse a Lightning Address into its components
   */
  private async parseAddressFormat(
    fullAddress: string,
  ): Promise<ParsedAddress> {
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
   */
  private async resolveAddress(fullAddress: string): Promise<ResolvedAddress> {
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
   */
  private async resolveStandardAddress(
    address: string,
  ): Promise<ResolvedAddress> {
    this.logger.log(`Resolving standard address: ${address}`);

    const lightningAddress = await this.lightningAddressRepository.findOne({
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
   */
  private async resolveMemberChamaAddress(
    username: string,
    chamaname: string,
  ): Promise<ResolvedAddress> {
    this.logger.log(`Resolving member-chama address: ${username}-${chamaname}`);

    // First, find the user's Lightning Address
    const userAddress = await this.lightningAddressRepository.findOne({
      address: username.toLowerCase(),
      type: AddressType.PERSONAL,
      'settings.enabled': true,
    });

    if (!userAddress) {
      throw new NotFoundException(`User ${username} not found`);
    }

    // Then, find the chama's Lightning Address
    const chamaAddress = await this.lightningAddressRepository.findOne({
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
   */
  private async isAddressAvailable(address: string): Promise<boolean> {
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
    try {
      await this.lightningAddressRepository.findOne({
        address: normalizedAddress,
      });
      // If we get here, the address exists
      return false;
    } catch (error) {
      // If NotFoundException is thrown, the address is available
      if (error instanceof NotFoundException) {
        return true;
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Find Lightning Address by owner
   */
  private async findByOwner(
    ownerId: string,
    type?: AddressType,
  ): Promise<LightningAddressDocument | null> {
    const query: any = { ownerId };
    if (type) {
      query.type = type;
    }

    try {
      return await this.lightningAddressRepository.findOne(query);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get payment history for a Lightning Address
   */
  async getPaymentHistory(
    addressId: string,
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{
    transactions: LnurlTransactionDocument[];
    total: number;
    address: string;
  }> {
    this.logger.log(
      `Getting payment history for address ${addressId} by user ${userId}`,
    );

    // First, verify the address exists and belongs to the user
    const address = await this.findById(addressId);
    if (!address) {
      throw new NotFoundException('Lightning Address not found');
    }

    // Check ownership based on address type
    let isOwner = false;
    switch (address.type) {
      case AddressType.PERSONAL:
        isOwner = address.ownerId === userId;
        break;
      case AddressType.CHAMA:
      case AddressType.MEMBER_CHAMA:
        // For chama addresses, check if user is a member
        // This would require checking chama membership
        isOwner = address.ownerId === userId || address.memberId === userId;
        break;
    }

    if (!isOwner) {
      throw new ForbiddenException(
        'You do not have permission to view this address history',
      );
    }

    // Get transactions for this address
    const result = await this.lnurlTransactionService.findByAddress(addressId, {
      type: LnurlType.PAY_IN,
      limit,
      offset,
    });

    return {
      transactions: result.transactions,
      total: result.total,
      address: `${address.address}@${address.domain}`,
    };
  }
}
