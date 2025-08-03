import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
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

    const amountMsats = parseInt(amount);
    if (isNaN(amountMsats)) {
      throw new Error('Invalid amount');
    }

    return await this.lightningAddressService.processPaymentCallback(
      address,
      amountMsats,
      { comment, nostr: nostr ? JSON.parse(nostr) : undefined },
    );
  }
}
