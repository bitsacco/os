import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  ChamasServiceControllerMethods,
  CreateChamaDto,
  FilterChamasDto,
  FindChamaDto,
  InviteMembersDto,
  JoinChamaDto,
  UpdateChamaDto,
} from '@bitsacco/common';
import { ChamasService } from './chamas/chamas.service';

@Controller()
@ChamasServiceControllerMethods()
export class ChamaController {
  constructor(private readonly chamasService: ChamasService) {}

  @GrpcMethod()
  createChama(request: CreateChamaDto) {
    return this.chamasService.createChama(request);
  }

  @GrpcMethod()
  updateChama(request: UpdateChamaDto) {
    return this.chamasService.updateChama(request);
  }

  @GrpcMethod()
  joinChama(request: JoinChamaDto) {
    return this.chamasService.joinChama(request);
  }

  @GrpcMethod()
  inviteMembers(request: InviteMembersDto) {
    return this.chamasService.inviteMembers(request);
  }

  @GrpcMethod()
  findChama(request: FindChamaDto) {
    return this.chamasService.findChama(request);
  }

  @GrpcMethod()
  filterChamas(request: FilterChamasDto) {
    return this.chamasService.filterChamas(request);
  }
}
