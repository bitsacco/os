import NDK, {
  NDKEvent,
  NDKPrivateKeySigner,
  NDKRelay,
  NDKUser,
} from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import {
  ConfigureNostrRelaysDto,
  NostrRecipient,
  SendEncryptedNostrDmDto,
} from '../common';
import {
  NostrMessageType,
  NostrMetricsService,
  NostrOperation,
  NostrRecipientType,
} from './nostr.metrics';

const explicitRelayUrls = [
  'wss://relay.damus.io',
  'wss://relay.nostr.bg',
  'wss://relay.snort.social',
  'wss://nostr.mom',
  'wss://nos.lol',
  'wss://relay.nostr.bg',
];

@Injectable()
export class NostrService {
  private readonly logger = new Logger(NostrService.name);
  private readonly ndk: NDK;
  private readonly pubkey: string;
  private connected = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: NostrMetricsService,
  ) {
    this.logger.log('NostrService created');

    const privkey = this.configService.getOrThrow<string>('NOSTR_PRIVATE_KEY');
    this.pubkey = this.configService.getOrThrow<string>('NOSTR_PUBLIC_KEY');

    const signer = new NDKPrivateKeySigner(privkey);
    this.ndk = new NDK({
      explicitRelayUrls,
      signer,
    });

    this.ndk.pool.on('relay:connect', (relay: NDKRelay) => {
      this.logger.log(`Connected to relay: ${relay.url}`);

      // Record successful relay connection metric
      this.metricsService.recordRelayMetric({
        relayUrl: relay.url,
        operation: NostrOperation.connect,
        success: true,
        duration: 0, // We don't have duration here
      });

      // Update connected relays count
      this.metricsService.updateConnectedRelaysCount(
        this.ndk.pool.connectedRelays().length,
      );
    });

    this.ndk.pool.on('relay:disconnect', (relay: NDKRelay) => {
      this.logger.warn(`Disconnected from relay: ${relay.url}`);

      // Record relay disconnection metric
      this.metricsService.recordRelayMetric({
        relayUrl: relay.url,
        operation: NostrOperation.disconnect,
        success: true,
        duration: 0, // We don't have duration here
      });

      // Update connected relays count
      this.metricsService.updateConnectedRelaysCount(
        this.ndk.pool.connectedRelays().length,
      );
    });

    this.connectRelays()
      .then(() => {
        this.logger.log('NostrService connected');
        this.connected = true;

        // Update connected relays count
        this.metricsService.updateConnectedRelaysCount(
          this.ndk.pool.connectedRelays().length,
        );
      })
      .catch(() => {
        this.logger.warn('NostrService disconnected');
        this.connected = false;
      });
  }

  private async connectRelays() {
    const startTime = Date.now();
    try {
      await this.ndk.connect();
      // Wait one sec for connections to stabilize
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const connectedCount = this.ndk.pool.connectedRelays().length;
      this.logger.log(`${connectedCount} relays connected`);

      // Record success metric for overall relay connection operation
      this.metricsService.recordRelayMetric({
        relayUrl: 'all',
        operation: NostrOperation.connect,
        success: true,
        duration: Date.now() - startTime,
      });
    } catch (e) {
      this.logger.error(`Failed to connect nostr relays, ${e}`);

      // Record failure metric
      this.metricsService.recordRelayMetric({
        relayUrl: 'all',
        operation: NostrOperation.connect,
        success: false,
        duration: Date.now() - startTime,
        errorType: e.message || 'Unknown error',
      });

      throw e;
    }
  }

  private async publishEventWithRetry(dm: NDKEvent, maxAttempts: number = 2) {
    let attempts = 0;
    let totalDuration = 0;

    while (attempts < maxAttempts) {
      const attemptStartTime = Date.now();
      attempts++;

      try {
        await dm.publish();
        this.logger.log('Published Nostr event');

        // Record successful publish metric with duration of successful attempt only
        const attemptDuration = Date.now() - attemptStartTime;
        totalDuration += attemptDuration;

        this.metricsService.recordRelayMetric({
          relayUrl: 'all',
          operation: NostrOperation.publish,
          success: true,
          duration: attemptDuration,
        });

        return;
      } catch (error) {
        const attemptDuration = Date.now() - attemptStartTime;
        totalDuration += attemptDuration;

        if (attempts >= maxAttempts) {
          // Record final failed publish metric
          this.metricsService.recordRelayMetric({
            relayUrl: 'all',
            operation: NostrOperation.publish,
            success: false,
            duration: totalDuration,
            errorType: error.message || 'Unknown error',
          });

          throw new Error(
            `Failed to publish Nostr event after ${maxAttempts} attempts: ${error}`,
          );
        }

        // Record individual failed attempt metric
        this.metricsService.recordRelayMetric({
          relayUrl: 'all',
          operation: NostrOperation.publishAttempt,
          success: false,
          duration: attemptDuration,
          errorType: error.message || 'Unknown error',
        });

        this.logger.warn(`Publish attempt ${attempts} failed. Retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  private parseRecipient(recipient: NostrRecipient): string {
    if (!recipient) {
      this.logger.log(`Recipient undefined. Notifying self`);
      return this.pubkey;
    }

    const { npub, pubkey } = recipient;

    // todo: validate npub
    if (npub && npub.startsWith('npub')) {
      const { type, data } = nip19.decode(npub);
      if (type === 'npub') {
        return data as string;
      }
    }

    if (pubkey) {
      // todo: validate pubkey
      return pubkey;
    }
  }

  async sendEncryptedDirectMessage({
    message,
    recipient,
    retry = true,
  }: SendEncryptedNostrDmDto): Promise<void> {
    const startTime = Date.now();
    let recipientType = NostrRecipientType.other;
    let errorType: string | undefined;

    try {
      if (!this.connected) {
        await this.connectRelays();
      }

      const receiver = this.parseRecipient(recipient) || this.pubkey;

      // Determine recipient type for metrics
      if (receiver === this.pubkey) {
        recipientType = NostrRecipientType.self;
      } else {
        recipientType = NostrRecipientType.user; // Default for individual user
      }

      this.logger.log(
        `${this.ndk.pool.connectedRelays().length} relays connected`,
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
      this.metricsService.recordMessageMetric({
        messageType: NostrMessageType.encrypted,
        recipientType,
        success: true,
        duration: Date.now() - startTime,
      });

      return;
    } catch (error) {
      errorType = error.message || 'Unknown error';
      this.logger.error(error);

      // Record failed message metric
      this.metricsService.recordMessageMetric({
        messageType: NostrMessageType.encrypted,
        recipientType,
        success: false,
        duration: Date.now() - startTime,
        errorType,
      });

      return;
    }
  }

  async configureNostrRelays(req: ConfigureNostrRelaysDto): Promise<void> {
    this.logger.log(req);
    return;
  }
}
