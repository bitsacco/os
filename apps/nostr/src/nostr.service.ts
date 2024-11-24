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
} from '@bitsacco/common';

const explicitRelayUrls = [
  'wss://relay.damus.io',
  'wss://relay.nostr.bg',
  'wss://relay.snort.social',
  'wss://nostr.mom',
  'wss://nos.lol',
  'wss://relay.nostr.bg'
];

@Injectable()
export class NostrService {
  private readonly logger = new Logger(NostrService.name);
  private readonly ndk: NDK;
  private readonly pubkey: string;
  private connected = false;

  constructor(private readonly configService: ConfigService) {
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
    });

    this.ndk.pool.on('relay:disconnect', (relay: NDKRelay) => {
      this.logger.warn(`Disconnected from relay: ${relay.url}`);
    });

    this.connectRelays()
      .then(() => {
        this.logger.log('NostrService connected');
        this.connected = true;
      })
      .catch((e) => {
        this.logger.warn('NostrService disconnected');
        this.connected = false;
      });
  }

  private async connectRelays() {
    try {
      await this.ndk.connect();
      // Wait one sec for connections to stabilize
      await new Promise((resolve) => setTimeout(resolve, 1000));
      this.logger.log(
        `${this.ndk.pool.connectedRelays().length} relays connected`,
      );
    } catch (e) {
      this.logger.error(`Failed to connect nostr relays, ${e}`);
      throw e;
    }
  }

  private async publishEventWithRetry(dm: NDKEvent, maxAttempts: number = 2) {
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        await dm.publish();
        this.logger.log('Published Nostr event');
        return;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
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
    try {
      if (!this.connected) {
        await this.connectRelays();
      }

      const receiver = this.parseRecipient(recipient) || this.pubkey;

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

      return this.publishEventWithRetry(dm, retry ? 5 : 0);
    } catch (error) {
      this.logger.error(error);
      return;
    }
  }

  async configureNostrRelays(req: ConfigureNostrRelaysDto): Promise<void> {
    this.logger.log(req);
    return;
  }
}
