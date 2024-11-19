import { Test, TestingModule } from '@nestjs/testing';
import { NostrController } from './nostr.controller';

describe('NostrController', () => {
  let controller: NostrController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NostrController],
    }).compile();

    controller = module.get<NostrController>(NostrController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
