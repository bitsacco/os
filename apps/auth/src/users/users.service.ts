import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from './users.repository';
import { CreateUserRequestDto, GetUserDto } from '@bitsacco/common';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  private async validateCreateUserRequestDto(
    createUserDto: CreateUserRequestDto,
  ) {
    try {
      await this.usersRepository.findOne({
        where: [{ phone: createUserDto.phone }, { npub: createUserDto.npub }],
      });
    } catch (err) {
      return;
    }
    throw new UnprocessableEntityException('User details already exists.');
  }

  async createUser(createUserDto: CreateUserRequestDto) {
    await this.validateCreateUserRequestDto(createUserDto);
    return this.usersRepository.create({
      ...createUserDto,
      pin: await bcrypt.hash(createUserDto.pin, 10),
      phoneVerified: false,
    });
  }

  async verifyUser(phone: string, pin: string) {
    const user = await this.usersRepository.findOne({ phone });
    const pinIsValid = await bcrypt.compare(pin, user.pin);
    if (!pinIsValid) {
      throw new UnauthorizedException('Credentials are not valid.');
    }
    return user;
  }

  async findUser({ id }: GetUserDto) {
    return this.usersRepository.findOne({ _id: id });
  }
}
