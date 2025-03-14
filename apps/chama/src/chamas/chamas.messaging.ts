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
      const invitePromise = this.generateInviteMessage(member, chama)
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

  private async generateInviteMessage(
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

  async sendChamaWithdrawalRequests(
    chama: Chama,
    admins: ChamaAdminContact[],
    withdrawal: ChamaWalletTx,
  ) {
    const invitePromises = [];
    for (const admin of admins) {
      const invitePromise = this.generateWithdrawalMessage(
        chama,
        admin,
        withdrawal,
      )
        .then((message) => {
          admin.phoneNumber &&
            this.smsService.sendSms({
              message,
              receiver: admin.phoneNumber,
            });

          admin.nostrNpub &&
            this.logger.log(`Sending withdrawal request to ${admin.nostrNpub}`);
        })
        .catch((err) => this.logger.error(err));

      invitePromises.push(invitePromise);
    }
    Promise.allSettled(invitePromises).then((results) =>
      console.log('Sent withdrawal request', results),
    );
  }

  private async generateWithdrawalMessage(
    chama: Pick<Chama, 'id' | 'name' | 'description'>,
    admin: ChamaAdminContact,
    withdrawal: ChamaWalletTx,
  ): Promise<string> {
    const token = await this.encodeWithdrawal(chama, admin, withdrawal);
    this.logger.log(token);

    const chamaUrl = this.configService.getOrThrow('CHAMA_EXPERIENCE_URL');
    const link = await this.shortenLink(`${chamaUrl}/tx/?t=${token}`);
    const message = `${
      admin.name || admin.phoneNumber
    } requested withdrawal from '${chama.name}'. Click ${link} to review.`;

    this.logger.log(message);

    return message;
  }

  private async encodeWithdrawal(
    chama: Pick<Chama, 'id' | 'name' | 'description'>,
    admin: ChamaAdminContact,
    withdrawal: ChamaWalletTx,
  ): Promise<string> {
    if (!admin.phoneNumber && !admin.nostrNpub) {
      throw new BadRequestException(
        `Invalid chama admin ${JSON.stringify(admin)}`,
      );
    }

    return this.jwtService.sign(
      {
        chama,
        admin,
        withdrawal,
      },
      {
        secret: this.jwtSecret,
      },
    );
  }
}

export interface ChamaAdminContact {
  name?: string;
  phoneNumber?: string | undefined;
  nostrNpub?: string | undefined;
}
