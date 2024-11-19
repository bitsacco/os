import {
  ConfigureNostrRelaysDto,
  NOSTR_SERVICE_NAME,
  NostrServiceClient,
  SendEncryptedNostrDmDto,
} from '@bitsacco/common';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';

@Injectable()
export class NostrService implements OnModuleInit {
  private client: NostrServiceClient;

  constructor(@Inject(NOSTR_SERVICE_NAME) private readonly grpc: ClientGrpc) {}

  onModuleInit() {
    this.client = this.grpc.getService<NostrServiceClient>(NOSTR_SERVICE_NAME);
  }

  sendEncryptedNostrDm(req: SendEncryptedNostrDmDto) {
    return this.client.sendEncryptedNostrDirectMessage(req);
  }

  configureNostrRelays(req: ConfigureNostrRelaysDto) {
    return this.client.configureTrustedNostrRelays(req);
  }
}
