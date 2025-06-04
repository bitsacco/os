import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  ConfigureNostrRelaysDto,
  NostrServiceControllerMethods,
  SendEncryptedNostrDmDto,
} from '@bitsacco/common';
import { NostrService } from './nostr.service';

@Controller()
@NostrServiceControllerMethods()
export class NostrController {
  constructor(private readonly nostrService: NostrService) {}

  @GrpcMethod()
  configureTrustedNostrRelays(request: ConfigureNostrRelaysDto) {
    return this.nostrService.configureNostrRelays(request);
  }

  @GrpcMethod()
  sendEncryptedNostrDirectMessage(request: SendEncryptedNostrDmDto) {
    return this.nostrService.sendEncryptedDirectMessage(request);
  }
}
