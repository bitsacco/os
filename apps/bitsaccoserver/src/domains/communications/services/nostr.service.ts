import NDK, {
  NDKEvent,
  NDKPrivateKeySigner,
  NDKRelay,
  NDKUser,
} from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseDomainService } from '../../../shared/domain/base-domain.service';
import { BusinessMetricsService } from '../../../infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../../infrastructure/monitoring/telemetry.service';

// Define interfaces locally to avoid import issues
export interface NostrRecipient {
  npub?: string;
  pubkey?: string;
}

export interface SendEncryptedNostrDmDto {
  message: string;
  recipient?: NostrRecipient;
  retry?: boolean;
}

export interface ConfigureNostrRelaysDto {
  relayUrls: string[];
}

const explicitRelayUrls = [
  'wss://relay.damus.io',
  'wss://relay.nostr.bg',
  'wss://relay.snort.social',
  'wss://nostr.mom',
  'wss://nos.lol',
  'wss://relay.nostr.bg',
];

@Injectable()
export class NostrService extends BaseDomainService {
  private readonly logger = new Logger(NostrService.name);
  private readonly ndk: NDK;
  private readonly pubkey: string;
  private connected = false;

  constructor(
    protected readonly eventEmitter: EventEmitter2,
    protected readonly metricsService: BusinessMetricsService,
    protected readonly telemetryService: TelemetryService,
    private readonly configService: ConfigService,
  ) {
    super(eventEmitter, metricsService, telemetryService);
    this.logger.log('Communications Nostr Service initialized');

    const privkey = this.configService.getOrThrow<string>('NOSTR_PRIVATE_KEY');
    this.pubkey = this.configService.getOrThrow<string>('NOSTR_PUBLIC_KEY');

    const signer = new NDKPrivateKeySigner(privkey);
    this.ndk = new NDK({
      explicitRelayUrls,
      signer,
    });

    this.setupRelayEventHandlers();
    this.initializeConnections();
  }

  private setupRelayEventHandlers(): void {
    this.ndk.pool.on('relay:connect', (relay: NDKRelay) => {
      this.logger.log(`Connected to relay: ${relay.url}`);

      // Record successful relay connection metric
      this.metricsService.recordCommunicationMetric(
        'nostr',
        'relay_connect',
        true,
        0,
        {
          relayUrl: relay.url,
          connectedRelays: this.ndk.pool.connectedRelays().length,
        },
      );
    });

    this.ndk.pool.on('relay:disconnect', (relay: NDKRelay) => {
      this.logger.warn(`Disconnected from relay: ${relay.url}`);

      // Record relay disconnection metric
      this.metricsService.recordCommunicationMetric(
        'nostr',
        'relay_disconnect',
        true,
        0,
        {
          relayUrl: relay.url,
          connectedRelays: this.ndk.pool.connectedRelays().length,
        },
      );
    });
  }

  private async initializeConnections(): Promise<void> {
    try {
      await this.connectRelays();
      this.logger.log('Nostr Service connected successfully');
      this.connected = true;
    } catch (error) {
      this.logger.warn('Nostr Service failed to connect', error);
      this.connected = false;
    }
  }

  private async connectRelays(): Promise<void> {
    return this.executeWithErrorHandling('connectRelays', async () => {
      const startTime = Date.now();

      try {
        await this.ndk.connect();
        // Wait for connections to stabilize
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const connectedCount = this.ndk.pool.connectedRelays().length;
        this.logger.log(`${connectedCount} relays connected`);

        // Record successful relay connection metric
        await this.metricsService.recordCommunicationMetric(
          'nostr',
          'relay_connect_all',
          true,
          Date.now() - startTime,
          {
            connectedRelays: connectedCount,
          },
        );
      } catch (error) {
        this.logger.error(`Failed to connect nostr relays: ${error.message}`);

        // Record failed relay connection metric
        await this.metricsService.recordCommunicationMetric(
          'nostr',
          'relay_connect_all',
          false,
          Date.now() - startTime,
          {
            errorType: error.message || 'unknown_error',
          },
        );

        throw error;
      }
    });
  }

  private async publishEventWithRetry(
    dm: NDKEvent,
    maxAttempts: number = 2,
  ): Promise<void> {
    let attempts = 0;
    let totalDuration = 0;

    while (attempts < maxAttempts) {
      const attemptStartTime = Date.now();
      attempts++;

      try {
        await dm.publish();
        this.logger.log('Published Nostr event successfully');

        // Record successful publish metric
        const attemptDuration = Date.now() - attemptStartTime;
        totalDuration += attemptDuration;

        await this.metricsService.recordCommunicationMetric(
          'nostr',
          'publish',
          true,
          attemptDuration,
          {
            attempts,
            connectedRelays: this.ndk.pool.connectedRelays().length,
          },
        );

        return;
      } catch (error) {
        const attemptDuration = Date.now() - attemptStartTime;
        totalDuration += attemptDuration;

        if (attempts >= maxAttempts) {
          // Record final failed publish metric
          await this.metricsService.recordCommunicationMetric(
            'nostr',
            'publish',
            false,
            totalDuration,
            {
              attempts,
              errorType: error.message || 'unknown_error',
            },
          );

          throw new Error(
            `Failed to publish Nostr event after ${maxAttempts} attempts: ${error}`,
          );
        }

        this.logger.warn(`Publish attempt ${attempts} failed. Retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  private parseRecipient(recipient: NostrRecipient): string {
    if (!recipient) {
      this.logger.log('Recipient undefined. Notifying self');
      return this.pubkey;
    }

    const { npub, pubkey } = recipient;

    if (npub && npub.startsWith('npub')) {
      const { type, data } = nip19.decode(npub);
      if (type === 'npub') {
        return data as string;
      }
    }

    if (pubkey) {
      return pubkey;
    }

    return this.pubkey;
  }

  async sendEncryptedDirectMessage({
    message,
    recipient,
    retry = true,
  }: SendEncryptedNostrDmDto): Promise<void> {
    return this.executeWithErrorHandling(
      'sendEncryptedDirectMessage',
      async () => {
        const startTime = Date.now();
        let recipientType = 'other';

        try {
          if (!this.connected) {
            await this.connectRelays();
          }

          const receiver = this.parseRecipient(recipient) || this.pubkey;

          // Determine recipient type for metrics
          if (receiver === this.pubkey) {
            recipientType = 'self';
          } else {
            recipientType = 'user';
          }

          this.logger.log(
            `Sending encrypted DM to ${recipient?.npub || recipient?.pubkey || 'self'} via ${this.ndk.pool.connectedRelays().length} relays`,
          );

          const dm = new NDKEvent(this.ndk, {
            kind: 4,
            content: message,
            tags: [['p']],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: this.pubkey,
          });

          const user = new NDKUser({ pubkey: receiver });
          dm.encrypt(user);

          await this.publishEventWithRetry(dm, retry ? 5 : 0);

          // Record successful message metric
          await this.metricsService.recordCommunicationMetric(
            'nostr',
            'send_encrypted_dm',
            true,
            Date.now() - startTime,
            {
              recipientType,
              messageLength: message.length,
              connectedRelays: this.ndk.pool.connectedRelays().length,
            },
          );
        } catch (error) {
          this.logger.error(
            `Error sending encrypted DM: ${error.message}`,
            error.stack,
          );

          // Record failed message metric
          await this.metricsService.recordCommunicationMetric(
            'nostr',
            'send_encrypted_dm',
            false,
            Date.now() - startTime,
            {
              recipientType,
              messageLength: message.length,
              errorType: error.message || 'unknown_error',
            },
          );

          throw error;
        }
      },
    );
  }

  async configureNostrRelays(req: ConfigureNostrRelaysDto): Promise<void> {
    return this.executeWithErrorHandling('configureNostrRelays', async () => {
      this.logger.log(`Configuring Nostr relays: ${req.relayUrls}`);
      // Implementation for relay configuration would go here
      // For now, just log the request
    });
  }

  // Legacy compatibility methods for microservice interface
  async configureTrustedNostrRelaysLegacy(
    request: ConfigureNostrRelaysDto,
  ): Promise<void> {
    return this.configureNostrRelays(request);
  }

  async sendEncryptedNostrDirectMessageLegacy(
    request: SendEncryptedNostrDmDto,
  ): Promise<void> {
    return this.sendEncryptedDirectMessage(request);
  }

  // Health check method
  isConnected(): boolean {
    return this.connected && this.ndk.pool.connectedRelays().length > 0;
  }

  getConnectedRelaysCount(): number {
    return this.ndk.pool.connectedRelays().length;
  }
}
