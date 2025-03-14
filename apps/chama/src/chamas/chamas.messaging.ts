import { BitlyClient } from 'bitly';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { type ClientGrpc } from '@nestjs/microservices';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  SmsServiceClient,
  SMS_SERVICE_NAME,
  type Chama,
  type ChamaInvite,
  ChamaWalletTx,
  User,
} from '@bitsacco/common';

@Injectable()
export class ChamaMessageService {
  private readonly jwtSecret: string;
  private readonly bitlyClient: BitlyClient;
  private readonly smsService: SmsServiceClient;
  private readonly logger = new Logger(ChamaMessageService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(SMS_SERVICE_NAME) smsGrpc: ClientGrpc,
  ) {
    this.jwtSecret = this.configService.getOrThrow('JWT_SECRET');

    const bitlyToken = this.configService.getOrThrow('BITLY_TOKEN');
    this.bitlyClient = new BitlyClient(bitlyToken);

    this.smsService = smsGrpc.getService<SmsServiceClient>(SMS_SERVICE_NAME);
    this.logger.debug('SMS Service Connected');

    this.logger.debug('ChamaMessageService started');
  }

  private async shortenLink(link: string): Promise<string> {
    return (await this.bitlyClient.shorten(link)).link;
  }

  async sendChamaInvites(chama: Chama, invites: ChamaInvite[]) {
    const invitePromises = [];
    for (const member of invites) {
      const invitePromise = this.generateInviteLink(member, chama)
        .then((message) => {
          member.phoneNumber &&
            this.smsService.sendSms({
              message,
              receiver: member.phoneNumber,
            });

          member.nostrNpub &&
            this.logger.log(`Sending chama invite to ${member.nostrNpub}`);
        })
        .catch((err) => this.logger.error(err));

      invitePromises.push(invitePromise);
    }
    Promise.allSettled(invitePromises).then((results) =>
      console.log('Sent chama invites', results),
    );
  }

  private async generateInviteLink(
    member: ChamaInvite,
    { id, name, description }: Pick<Chama, 'id' | 'name' | 'description'>,
  ): Promise<string> {
    const token = await this.encodeChamaInvite(member, {
      id,
      name,
      description,
    });
    this.logger.log(token);

    const chamaUrl = this.configService.getOrThrow('CHAMA_EXPERIENCE_URL');
    const link = await this.shortenLink(`${chamaUrl}/join/?t=${token}`);

    const invite = `Welcome to ${name} chama on BITSACCO. Click ${link} to join`;
    this.logger.log(invite);

    return invite;
  }

  private async encodeChamaInvite(
    member: ChamaInvite,
    chama: Pick<Chama, 'id' | 'name' | 'description'>,
  ): Promise<string> {
    if (!member.phoneNumber && !member.nostrNpub) {
      throw new BadRequestException(
        `Invalid chama invite ${JSON.stringify(member)}`,
      );
    }

    return this.jwtService.sign(
      {
        chama,
        member,
      },
      {
        secret: this.jwtSecret,
      },
    );
  }

  async sendChamaWithdrawalApprovalLink(
    chama: Chama,
    admins: User[],
    withdrawal: ChamaWalletTx,
  ) {
    console.log(chama);
    console.log(admins);
    console.log(withdrawal);
  }
}
