import { Test, TestingModule } from '@nestjs/testing';
import { NostrController } from './nostr.controller';
import { NostrService } from './nostr.service';

describe('NostrController', () => {
  let nostrController: NostrController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [NostrController],
      providers: [NostrService],
    }).compile();

    nostrController = app.get<NostrController>(NostrController);
  });
});
