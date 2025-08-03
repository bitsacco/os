import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LightningAddressDocument, LightningAddressRepository } from '../db';
import { LnurlMetricsService } from '../lnurl.metrics';
import { SolowalletService } from '../../solowallet/solowallet.service';
import { ChamaWalletService } from '../../chamawallet/wallet.service';
import { ChamasService } from '../../chamas/chamas.service';
import { LnurlCommonService } from './lnurl-common.service';
import { LnurlTransactionService } from './lnurl-transaction.service';
import {
  FedimintService,
  AddressType,
  LightningAddressMetadata,
  LightningAddressSettings,
  LnurlPayResponse,
  LnurlPayInvoiceResponse,
  PaymentOptions,
  LnurlType,
  LnurlSubType,
  ResolvedAddress,
  ParsedAddress,
  TransactionStatus,
  LnurlTransactionDocument,
  isLightningAddress,
} from '../../common';

@Injectable()
export class LightningAddressService {
  private readonly logger = new Logger(LightningAddressService.name);

  constructor(
    private readonly lightningAddressRepository: LightningAddressRepository,
    private readonly lnurlCommonService: LnurlCommonService,
    private readonly lnurlMetricsService: LnurlMetricsService,
    private readonly lnurlTransactionService: LnurlTransactionService,
    private readonly fedimintService: FedimintService,
    private readonly solowalletService: SolowalletService,
    private readonly chamaWalletService: ChamaWalletService,
    private readonly chamasService: ChamasService,
    private readonly eventEmitter: EventEmitter2,
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
      maxSendable: metadata?.maxSendable || 100000000000, // 100k sats maximum
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
    const fullAddress = `${address}@${this.lnurlCommonService.isInternalDomain('bitsacco.com') ? 'bitsacco.com' : 'bitsacco.com'}`;
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
      // Resolve the address
      const fullAddress = `${address}@${this.lnurlCommonService.isInternalDomain('bitsacco.com') ? 'bitsacco.com' : 'bitsacco.com'}`;
      const resolved = await this.resolveAddress(fullAddress);

      if (resolved.type !== 'internal' || !resolved.metadata) {
        throw new NotFoundException('Lightning Address not found');
      }

      // Validate amount
      if (
        !this.lnurlCommonService.validateAmount(
          amountMsats,
          resolved.metadata.minSendable,
          resolved.metadata.maxSendable,
        )
      ) {
        const minSats = Math.floor(resolved.metadata.minSendable / 1000);
        const maxSats = Math.floor(resolved.metadata.maxSendable / 1000);
        throw new BadRequestException(
          `Amount must be between ${resolved.metadata.minSendable} and ${resolved.metadata.maxSendable} millisatoshis (${minSats} to ${maxSats} sats). You requested ${amountMsats} millisatoshis.`,
        );
      }

      // Generate invoice
      const description = options?.comment
        ? `${resolved.metadata.description} - ${options.comment}`
        : resolved.metadata.description || 'Bitsacco Payment';

      const invoice = await this.fedimintService.invoice(
        amountMsats,
        description,
      );

      // Create transaction record
      const transaction = await this.lnurlTransactionService.createTransaction({
        type: LnurlType.PAY_IN,
        subType: LnurlSubType.LIGHTNING_ADDRESS,
        userId: resolved.ownerId!,
        chamaId:
          resolved.addressType === AddressType.CHAMA
            ? resolved.ownerId
            : undefined,
        amountMsats,
        lnurlData: {
          lightningAddress: {
            address: fullAddress,
            addressId: resolved.addressId!,
            comment: options?.comment,
          },
        },
        reference: `Lightning Address payment to ${fullAddress}`,
      });

      // Update with lightning details
      await this.lnurlTransactionService.updateTransactionStatus(
        transaction._id.toString(),
        TransactionStatus.PENDING,
        {
          lightning: {
            invoice: invoice.invoice,
            operationId: invoice.operationId,
          },
        },
      );

      // Start monitoring for payment
      this.monitorPayment(
        transaction._id.toString(),
        invoice.operationId,
        resolved,
      );

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
        pr: invoice.invoice,
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
   * Monitor payment and update wallet on success
   */
  private monitorPayment(
    transactionId: string,
    operationId: string,
    resolved: ResolvedAddress,
  ): void {
    this.logger.log(`Monitoring payment for transaction ${transactionId}`);

    // Set up payment timeout
    const timeoutId = setTimeout(
      () => this.handlePaymentTimeout(transactionId, operationId),
      300000, // 5 minutes
    );

    // Listen for payment success
    this.eventEmitter.once(
      `fedimint.receive.success.${operationId}`,
      async () => {
        clearTimeout(timeoutId);
        await this.handlePaymentSuccess(transactionId, resolved);
      },
    );

    // Listen for payment failure
    this.eventEmitter.once(
      `fedimint.receive.failure.${operationId}`,
      async (data) => {
        clearTimeout(timeoutId);
        await this.handlePaymentFailure(transactionId, data.error);
      },
    );
  }

  /**
   * Handle payment timeout
   */
  private async handlePaymentTimeout(
    transactionId: string,
    operationId: string,
  ): Promise<void> {
    this.logger.warn(
      `Payment timeout for operation ${operationId}, marking as failed`,
    );

    await this.lnurlTransactionService.updateTransactionStatus(
      transactionId,
      TransactionStatus.FAILED,
      {
        completedAt: new Date(),
        error: 'Payment timeout - no response received',
      },
    );
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(
    transactionId: string,
    resolved: ResolvedAddress,
  ): Promise<void> {
    try {
      // Update transaction status
      const transaction =
        await this.lnurlTransactionService.updateTransactionStatus(
          transactionId,
          TransactionStatus.COMPLETE,
          { completedAt: new Date() },
        );

      if (!transaction) {
        this.logger.error(`Transaction ${transactionId} not found`);
        return;
      }

      // Process the deposit
      await this.processDeposit(transaction, resolved);

      // Send notification if enabled
      if (resolved.settings?.notifyOnPayment) {
        this.eventEmitter.emit('payment.received', {
          userId: resolved.ownerId,
          amount: transaction.amountMsats,
          address: transaction.lnurlData.lightningAddress?.address,
        });
      }

      this.logger.log(`Payment completed for transaction ${transactionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process payment completion: ${error.message}`,
      );
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailure(
    transactionId: string,
    error?: string,
  ): Promise<void> {
    try {
      await this.lnurlTransactionService.updateTransactionStatus(
        transactionId,
        TransactionStatus.FAILED,
        {
          completedAt: new Date(),
          error: error || 'Payment failed',
        },
      );

      this.logger.error(
        `Payment failed for transaction ${transactionId}: ${error}`,
      );
    } catch (updateError) {
      this.logger.error(
        `Failed to update failed payment: ${updateError.message}`,
      );
    }
  }

  /**
   * Process deposit to appropriate wallet
   */
  private async processDeposit(
    transaction: LnurlTransactionDocument,
    resolved: ResolvedAddress,
  ): Promise<void> {
    const reference = `Lightning Address payment received via ${transaction.lnurlData.lightningAddress?.address}`;

    switch (resolved.addressType) {
      case AddressType.PERSONAL:
        await this.solowalletService.depositFunds({
          userId: resolved.ownerId!,
          amountFiat: transaction.amountFiat,
          reference,
        });
        break;

      case AddressType.CHAMA:
      case AddressType.MEMBER_CHAMA:
        await this.chamaWalletService.deposit({
          chamaId: resolved.ownerId!,
          memberId: resolved.memberId || resolved.ownerId!,
          amountFiat: transaction.amountFiat,
          reference,
        });
        break;

      default:
        this.logger.warn(`Unknown address type: ${resolved.addressType}`);
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
   * Get payment history for a Lightning Address
   */
  async getPaymentHistory(
    addressId: string,
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{
    payments: LnurlTransactionDocument[];
    total: number;
  }> {
    // Verify ownership
    await this.getAddress(addressId, userId);

    const { transactions: payments, total } =
      await this.lnurlTransactionService.findByUser(userId, {
        type: LnurlType.PAY_IN,
        limit,
        offset,
      });

    return { payments, total };
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
}
