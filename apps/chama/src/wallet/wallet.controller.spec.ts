import { Test, TestingModule } from '@nestjs/testing';
import { ChamaWalletController } from './wallet.controller';

describe('ChamaWalletController', () => {
  let controller: ChamaWalletController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChamaWalletController],
    }).compile();

    controller = module.get<ChamaWalletController>(ChamaWalletController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
