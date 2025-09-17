import { BitlyClient } from 'bitly';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { type Chama, type ChamaInvite } from '../common';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class ChamaMessageService {
  private readonly jwtSecret: string;
  private readonly bitlyClient: BitlyClient;
  private readonly logger = new Logger(ChamaMessageService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
  ) {
    this.jwtSecret = this.configService.getOrThrow('JWT_SECRET');

    const bitlyToken = this.configService.getOrThrow('BITLY_TOKEN');
    this.bitlyClient = new BitlyClient(bitlyToken);

    this.logger.debug('SMS Service injected');

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
              await this.smsService.sendSms({
                message,
                receiver: member.phoneNumber,
              });
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
    chamaTxId: string,
    admins: ChamaMemberContact[],
    beneficiary: ChamaMemberContact,
  ) {
    this.logger.debug(
      `Sending withdrawal requests to ${JSON.stringify(admins)}`,
    );

    if (!admins?.length) {
      return;
    }

    (async () => {
      try {
        const token = await this.encodeChamaDetails({
          chamaId: chama.id,
          chamaTxId,
        });
        this.logger.log(token);

        const message = await this.generateChamaDetailsDeepLink(
          token,
          chama.name,
          beneficiary,
        );

        Promise.allSettled(
          admins.map(async (admin) => {
            try {
              if (admin.phoneNumber) {
                try {
                  await this.smsService.sendSms({
                    message,
                    receiver: admin.phoneNumber,
                  });
                  this.logger.debug(
                    `Withdrawal SMS sent to ${admin.phoneNumber}`,
                  );
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
                this.logger.log(
                  `Sending withdrawal request to ${admin.nostrNpub}`,
                );
              }
            } catch (err) {
              this.logger.error(
                `Error sending withdrawal request: ${err.message}`,
                err,
              );
            }
          }),
        ).then((results) =>
          this.logger.log('Sent withdrawal requests', results),
        );
      } catch {
        this.logger.log(`Failed to encode chama details`);
      }
    })();
  }

  private async generateChamaDetailsDeepLink(
    token: string,
    chamaName: string,
    beneficiary: ChamaMemberContact,
  ): Promise<string> {
    const chamaUrl = this.configService.getOrThrow('CHAMA_EXPERIENCE_URL');
    const link = await this.shortenLink(`${chamaUrl}/details/?t=${token}`);
    const message = `${
      beneficiary.name || beneficiary.phoneNumber || beneficiary.nostrNpub
    } requested withdrawal from '${chamaName}'. Click ${link} to review.`;

    this.logger.log(message);

    return message;
  }

  private async encodeChamaDetails(data: ChamaTxEncode): Promise<string> {
    return this.jwtService.sign(data, {
      secret: this.jwtSecret,
    });
  }
}

export interface ChamaMemberContact {
  name?: string;
  phoneNumber?: string | undefined;
  nostrNpub?: string | undefined;
}

export interface ChamaTxEncode {
  chamaId: string;
  chamaTxId: string;
}
