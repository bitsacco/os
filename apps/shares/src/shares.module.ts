import { Module } from '@nestjs/common';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [],
  controllers: [SharesController],
  providers: [SharesService],
})
export class SharesModule {}
