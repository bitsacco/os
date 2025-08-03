import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { LightningAddressService } from '../services/lightning-address.service';

@ApiTags('LNURL Public')
@Controller()
export class LnurlPublicController {
  private readonly logger = new Logger(LnurlPublicController.name);

  constructor(
    private readonly lightningAddressService: LightningAddressService,
  ) {}

  /**
   * Safely parse JSON with validation and error handling
   * @param jsonString - The JSON string to parse
   * @param fieldName - The name of the field being parsed (for error messages)
   * @returns Parsed JSON object or undefined if invalid
   */
  private safeJsonParse(jsonString: string, fieldName: string): any {
    if (!jsonString || jsonString.trim() === '') {
      return undefined;
    }

    try {
      // First, validate that the string is not too large (prevent DoS)
      const maxLength = 10000; // 10KB limit for JSON input
      if (jsonString.length > maxLength) {
        throw new BadRequestException(
          `${fieldName} is too large (max ${maxLength} characters)`,
        );
      }

      // Attempt to parse the JSON
      const parsed = JSON.parse(jsonString);

      // Additional validation can be added here based on expected structure
      // For example, if we expect an object:
      if (typeof parsed !== 'object' || parsed === null) {
        throw new BadRequestException(
          `${fieldName} must be a valid JSON object`,
        );
      }

      return parsed;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Log the error for debugging but don't expose internal details
      this.logger.error(
        `Failed to parse ${fieldName}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Invalid JSON in ${fieldName} parameter. Please provide valid JSON.`,
      );
    }
  }

  /**
   * LNURL-pay endpoint (public)
   * This is the standard .well-known endpoint that external wallets will query
   */
  @Get('.well-known/lnurlp/:address')
  @ApiOperation({
    summary: 'LNURL-pay endpoint for Lightning Address',
    description:
      'Returns LNURL-pay metadata for a Lightning Address. This endpoint is queried by external Lightning wallets.',
  })
  @ApiParam({
    name: 'address',
    description: 'The Lightning Address username (without @domain)',
    example: 'alice',
  })
  @ApiResponse({
    status: 200,
    description: 'LNURL-pay metadata',
    schema: {
      example: {
        callback: 'https://bitsacco.com/v1/lnurl/callback/alice',
        maxSendable: 100000000,
        minSendable: 1000,
        metadata: '[["text/plain","Pay to alice@bitsacco.com"]]',
        tag: 'payRequest',
      },
    },
  })
  async getLnurlPay(@Param('address') address: string) {
    this.logger.log(`LNURL-pay request for address: ${address}`);
    return await this.lightningAddressService.generatePayResponse(address);
  }

  /**
   * LNURL-pay callback endpoint (public)
   * This handles the actual payment request after the wallet has shown the metadata
   */
  @Get('lnurl/callback/:address')
  @ApiOperation({
    summary: 'LNURL-pay callback endpoint',
    description:
      'Generates a Lightning invoice for payment. Called by wallets after displaying the LNURL-pay metadata.',
  })
  @ApiParam({
    name: 'address',
    description: 'The Lightning Address username',
    example: 'alice',
  })
  @ApiQuery({
    name: 'amount',
    description: 'Amount in millisatoshis',
    example: '10000',
  })
  @ApiQuery({
    name: 'comment',
    required: false,
    description: 'Optional comment from payer',
    example: 'Thanks for the coffee!',
  })
  @ApiResponse({
    status: 200,
    description: 'Lightning invoice response',
    schema: {
      example: {
        pr: 'lnbc500n1p3...',
        routes: [],
        successAction: {
          tag: 'message',
          message: 'Payment received! Thank you.',
        },
      },
    },
  })
  async lnurlCallback(
    @Param('address') address: string,
    @Query('amount') amount: string,
    @Query('comment') comment?: string,
    @Query('nostr') nostr?: string,
  ) {
    this.logger.log(`LNURL callback for ${address}, amount: ${amount}`);

    // Validate and parse amount
    const amountMsats = parseInt(amount);
    if (isNaN(amountMsats)) {
      throw new BadRequestException(
        'Invalid amount format. Amount must be a numeric string representing millisatoshis (e.g., "10000" for 10 sats).',
      );
    }

    if (amountMsats <= 0) {
      throw new BadRequestException(
        'Invalid amount value. Amount must be greater than 0 millisatoshis.',
      );
    }

    // Note: The actual min/max validation happens in the service layer after retrieving
    // the lightning address metadata, as limits can vary per address

    // Safely parse the nostr parameter if provided
    let parsedNostr: any;
    if (nostr) {
      parsedNostr = this.safeJsonParse(nostr, 'nostr');
    }

    return await this.lightningAddressService.processPaymentCallback(
      address,
      amountMsats,
      { comment, nostr: parsedNostr },
    );
  }
}
