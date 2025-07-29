import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LightningAddress,
  LightningAddressDocument,
} from '../schemas/lightning-address.schema';
import {
  LnurlTransaction,
  LnurlTransactionDocument,
} from '../schemas/lnurl-transaction.schema';
import { AddressResolverService } from './address-resolver.service';
import { LnurlCommonService } from './lnurl-common.service';
import { LnurlMetricsService } from '../lnurl.metrics';
import { FedimintService } from '../../common/fedimint/fedimint.service';
import { SolowalletService } from '../../solowallet/solowallet.service';
import { ChamaWalletService } from '../../chamawallet/wallet.service';
import { FxService } from '../../swap/fx/fx.service';
import {
  AddressType,
  LightningAddressMetadata,
  LightningAddressSettings,
  LnurlPayResponse,
  LnurlPayInvoiceResponse,
  PaymentOptions,
  LnurlType,
  LnurlSubType,
  ResolvedAddress,
} from '../types';
import { TransactionStatus, Currency } from '../../common/types';
import { mapToSupportedCurrency } from '../../common/utils';

@Injectable()
export class LightningAddressService {
  private readonly logger = new Logger(LightningAddressService.name);

  constructor(
    @InjectModel(LightningAddress.name)
    private readonly lightningAddressModel: Model<LightningAddressDocument>,
    @InjectModel(LnurlTransaction.name)
    private readonly lnurlTransactionModel: Model<LnurlTransactionDocument>,
    private readonly addressResolverService: AddressResolverService,
    private readonly lnurlCommonService: LnurlCommonService,
    private readonly lnurlMetricsService: LnurlMetricsService,
    private readonly fedimintService: FedimintService,
    private readonly solowalletService: SolowalletService,
    private readonly chamaWalletService: ChamaWalletService,
    private readonly eventEmitter: EventEmitter2,
    private readonly fxService: FxService,
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
    const isAvailable =
      await this.addressResolverService.isAddressAvailable(normalizedAddress);
    if (!isAvailable) {
      throw new ConflictException(
        `Address ${normalizedAddress} is not available`,
      );
    }

    // Check if owner already has an address of this type
    if (type === AddressType.PERSONAL) {
      const existing = await this.addressResolverService.findByOwner(
        ownerId,
        AddressType.PERSONAL,
      );
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

    const lightningAddress = new this.lightningAddressModel({
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
    });

    await lightningAddress.save();

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
    const address = await this.lightningAddressModel.findById(addressId);

    if (!address) {
      throw new NotFoundException('Lightning Address not found');
    }

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
    const address = await this.getAddress(addressId, userId);

    if (updates.metadata) {
      Object.assign(address.metadata, updates.metadata);
    }

    if (updates.settings) {
      Object.assign(address.settings, updates.settings);
    }

    address.updatedAt = new Date();
    await address.save();

    this.logger.log(
      `Lightning Address updated: ${address.address}@${address.domain}`,
    );

    return address;
  }

  /**
   * Delete Lightning Address
   */
  async deleteAddress(addressId: string, userId: string): Promise<void> {
    const address = await this.getAddress(addressId, userId);

    // Soft delete by disabling
    address.settings.enabled = false;
    address.updatedAt = new Date();
    await address.save();

    this.logger.log(
      `Lightning Address disabled: ${address.address}@${address.domain}`,
    );
  }

  /**
   * List user's Lightning Addresses
   */
  async listUserAddresses(userId: string): Promise<LightningAddressDocument[]> {
    return this.addressResolverService.findAllByOwner(userId);
  }

  /**
   * Generate LNURL-pay response for a Lightning Address
   */
  async generatePayResponse(address: string): Promise<LnurlPayResponse> {
    const fullAddress = `${address}@${this.lnurlCommonService.isInternalDomain('bitsacco.com') ? 'bitsacco.com' : 'bitsacco.com'}`;
    const resolved =
      await this.addressResolverService.resolveAddress(fullAddress);

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

    const startTime = Date.now();

    try {
      // Resolve the address
      const fullAddress = `${address}@${this.lnurlCommonService.isInternalDomain('bitsacco.com') ? 'bitsacco.com' : 'bitsacco.com'}`;
      const resolved =
        await this.addressResolverService.resolveAddress(fullAddress);

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
        throw new BadRequestException('Amount out of acceptable range');
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
      const exchangeRate = await this.getExchangeRate();
      const transaction = new this.lnurlTransactionModel({
        type: LnurlType.PAY_IN,
        subType: LnurlSubType.LIGHTNING_ADDRESS,
        status: TransactionStatus.PENDING,
        userId: resolved.ownerId!,
        chamaId:
          resolved.addressType === AddressType.CHAMA
            ? resolved.ownerId
            : undefined,
        amountMsats,
        amountFiat: this.lnurlCommonService.msatsToFiat(
          amountMsats,
          exchangeRate,
        ),
        currency: Currency.KES,
        lnurlData: {
          lightningAddress: {
            address: fullAddress,
            addressId: resolved.addressId!,
            comment: options?.comment,
          },
        },
        lightning: {
          invoice: invoice.invoice,
          operationId: invoice.operationId,
        },
        reference: `Lightning Address payment to ${fullAddress}`,
      });

      await transaction.save();

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
  private async monitorPayment(
    transactionId: string,
    operationId: string,
    resolved: ResolvedAddress,
  ): Promise<void> {
    this.logger.log(`Monitoring payment for transaction ${transactionId}`);

    // Set a timeout to handle cases where no event is received
    const timeoutId = setTimeout(async () => {
      this.logger.warn(
        `Payment timeout for operation ${operationId}, marking as failed`,
      );

      // Update transaction as failed due to timeout
      await this.lnurlTransactionModel.findByIdAndUpdate(transactionId, {
        status: TransactionStatus.FAILED,
        completedAt: new Date(),
        failureReason: 'Payment timeout - no response received',
      });
    }, 300000); // 5 minutes timeout

    // Listen for Fedimint payment success - using once() for automatic cleanup
    this.eventEmitter.once(
      `fedimint.receive.success.${operationId}`,
      async () => {
        // Clear the timeout since we received a response
        clearTimeout(timeoutId);

        try {
          // Update transaction status
          const transaction =
            await this.lnurlTransactionModel.findByIdAndUpdate(
              transactionId,
              {
                status: TransactionStatus.COMPLETE,
                completedAt: new Date(),
              },
              { new: true },
            );

          if (!transaction) {
            this.logger.error(`Transaction ${transactionId} not found`);
            return;
          }

          // Process the deposit based on address type
          if (resolved.addressType === AddressType.PERSONAL) {
            // Deposit to personal wallet
            await this.solowalletService.depositFunds({
              userId: resolved.ownerId!,
              amountFiat: transaction.amountFiat,
              reference: `Lightning Address payment received via ${transaction.lnurlData.lightningAddress?.address}`,
            });
          } else if (
            resolved.addressType === AddressType.CHAMA ||
            resolved.addressType === AddressType.MEMBER_CHAMA
          ) {
            // Deposit to chama wallet
            await this.chamaWalletService.deposit({
              chamaId: resolved.ownerId!, // Chama ID
              memberId: resolved.memberId || resolved.ownerId!, // Member ID for member-chama, or chama ID for direct chama deposits
              amountFiat: transaction.amountFiat,
              reference: `Lightning Address payment received via ${transaction.lnurlData.lightningAddress?.address}`,
            });
          }

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
      },
    );

    // Listen for payment failure - using once() for automatic cleanup
    this.eventEmitter.once(
      `fedimint.receive.failure.${operationId}`,
      async (data) => {
        // Clear the timeout since we received a response
        clearTimeout(timeoutId);

        try {
          await this.lnurlTransactionModel.findByIdAndUpdate(transactionId, {
            status: TransactionStatus.FAILED,
            completedAt: new Date(),
            failureReason: data.error || 'Payment failed',
          });

          this.logger.error(
            `Payment failed for transaction ${transactionId}: ${data.error}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to update failed payment: ${error.message}`,
          );
        }
      },
    );
  }

  /**
   * Update Lightning Address statistics
   */
  private async updateAddressStats(
    addressId: string,
    amountMsats: number,
  ): Promise<void> {
    await this.lightningAddressModel.findByIdAndUpdate(addressId, {
      $inc: {
        'stats.totalReceived': amountMsats,
        'stats.paymentCount': 1,
      },
      'stats.lastPaymentAt': new Date(),
    });
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

    const query = {
      type: LnurlType.PAY_IN,
      'lnurlData.lightningAddress.addressId': addressId,
    };

    const [payments, total] = await Promise.all([
      this.lnurlTransactionModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset),
      this.lnurlTransactionModel.countDocuments(query),
    ]);

    return { payments, total };
  }

  /**
   * Get exchange rate from FxService
   */
  private async getExchangeRate(): Promise<number> {
    try {
      // Get BTC to KES exchange rate
      const rate = await this.fxService.getExchangeRate(
        mapToSupportedCurrency(Currency.BTC),
        mapToSupportedCurrency(Currency.KES),
      );
      return rate;
    } catch (error) {
      this.logger.error(`Failed to get exchange rate: ${error.message}`);
      throw new Error(
        'Unable to fetch current exchange rate. Please try again later.',
      );
    }
  }
}
