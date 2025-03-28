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
import { firstValueFrom } from 'rxjs';
import {
  SmsServiceClient,
  SMS_SERVICE_NAME,
  type Chama,
  type ChamaInvite,
  ChamaWalletTx,
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
    @Inject(SMS_SERVICE_NAME) private readonly smsGrpc: ClientGrpc,
  ) {
    this.jwtSecret = this.configService.getOrThrow('JWT_SECRET');

    const bitlyToken = this.configService.getOrThrow('BITLY_TOKEN');
    this.bitlyClient = new BitlyClient(bitlyToken);

    this.smsService =
      this.smsGrpc.getService<SmsServiceClient>(SMS_SERVICE_NAME);

    if (!this.smsService) {
      this.logger.error('Failed to connect to SMS Service');
    } else {
      this.logger.debug('SMS Service Connected');
    }

    this.logger.debug('ChamaMessageService started');
  }

  private async shortenLink(link: string): Promise<string> {
    return (await this.bitlyClient.shorten(link)).link;
  }

  sendChamaInvites(chama: Chama, invites: ChamaInvite[]) {
    this.logger.debug(`Sending invites to ${JSON.stringify(invites)}`);

    if (!invites) {
      return;
    }

    Promise.allSettled(
      invites.map(async (member) => {
        try {
          const message = await this.generateInviteMessage(member, chama);

          if (member.phoneNumber) {
            try {
              await firstValueFrom(
                this.smsService.sendSms({
                  message,
                  receiver: member.phoneNumber,
                }),
              );
              this.logger.debug(`SMS sent to ${member.phoneNumber}`);
            } catch (smsError) {
              this.logger.error(
                `SMS send failure to ${member.phoneNumber}: ${smsError.message}`,
                {
                  error: smsError,
                  phone: member.phoneNumber,
                  message: message.substring(0, 30) + '...',
                },
              );
            }
          }

          if (member.nostrNpub) {
            this.logger.log(`Sending chama invite to ${member.nostrNpub}`);
          }
        } catch (err) {
          this.logger.error(`Error sending invite: ${err.message}`, err);
        }
      }),
    ).then((results) => this.logger.log('Sent chama invites', results));
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

    const invite = `You have been invited to ${name} chama on BITSACCO. Click ${link} to join`;
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

  sendChamaWithdrawalRequests(
    chama: Chama,
    admins: ChamaMemberContact[],
    withdrawal: ChamaWalletTx,
    beneficiary: ChamaMemberContact,
  ) {
    this.logger.debug(
      `Sending withdrawal requests to ${JSON.stringify(admins)}`,
    );

    if (!admins?.length) {
      return;
    }

    Promise.allSettled(
      admins.map(async (admin) => {
        try {
          const message = await this.generateWithdrawalMessage(
            chama,
            admin,
            withdrawal,
            beneficiary,
          );

          if (admin.phoneNumber) {
            try {
              await firstValueFrom(
                this.smsService.sendSms({
                  message,
                  receiver: admin.phoneNumber,
                }),
              );
              this.logger.debug(`Withdrawal SMS sent to ${admin.phoneNumber}`);
            } catch (smsError) {
              this.logger.error(
                `Withdrawal SMS send failure to ${admin.phoneNumber}: ${smsError.message}`,
                {
                  error: smsError,
                  phone: admin.phoneNumber,
                  message: message.substring(0, 30) + '...',
                },
              );
            }
          }

          if (admin.nostrNpub) {
            this.logger.log(`Sending withdrawal request to ${admin.nostrNpub}`);
          }
        } catch (err) {
          this.logger.error(
            `Error sending withdrawal request: ${err.message}`,
            err,
          );
        }
      }),
    ).then((results) => this.logger.log('Sent withdrawal requests', results));
  }

  private async generateWithdrawalMessage(
    chama: Pick<Chama, 'id' | 'name' | 'description'>,
    admin: ChamaMemberContact,
    withdrawal: ChamaWalletTx,
    beneficiary: ChamaMemberContact,
  ): Promise<string> {
    const token = await this.encodeWithdrawal(chama, admin, withdrawal);
    this.logger.log(token);

    const chamaUrl = this.configService.getOrThrow('CHAMA_EXPERIENCE_URL');
    const link = await this.shortenLink(`${chamaUrl}/tx/?t=${token}`);
    const message = `${
      beneficiary.name || beneficiary.phoneNumber || beneficiary.nostrNpub
    } requested withdrawal from '${chama.name}'. Click ${link} to review.`;

    this.logger.log(message);

    return message;
  }

  private async encodeWithdrawal(
    chama: Pick<Chama, 'id' | 'name' | 'description'>,
    admin: ChamaMemberContact,
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

export interface ChamaMemberContact {
  name?: string;
  phoneNumber?: string | undefined;
  nostrNpub?: string | undefined;
}
